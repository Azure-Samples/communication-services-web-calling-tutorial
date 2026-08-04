const CommunicationIdentityClient = require("@azure/communication-identity").CommunicationIdentityClient;
const { RoomsClient } = require('@azure/communication-rooms');
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./serverConfig.json");
const clientConfig = require("./clientConfig.json");
const axios = require("axios");
const bodyParser = require('body-parser');
const msal = require('@azure/msal-node');
const crypto = require('crypto');

const {authConfig, entraCredentialConfig} = require('./oAuthConfig');
const clientId = authConfig.configuration.auth.clientId;


if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `serverConfig.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);

const PORT = process.env.port || 8080;

const oneSignalRegistrationTokenToAcsUserAccesTokenMap = new Map();
const registerCommunicationUserForOneSignal = async (communicationAccessToken, communicationUserIdentifier) => {
    const oneSignalRegistrationToken = generateGuid();
    await axios({
        url: config.functionAppOneSignalTokenRegistrationUrl,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            communicationUserId: communicationUserIdentifier.communicationUserId,
            oneSignalRegistrationToken,
            oneSignalAppId: clientConfig.oneSignalAppId
        })
    }).then((response) => { return response.data });
    oneSignalRegistrationTokenToAcsUserAccesTokenMap.set(oneSignalRegistrationToken, { communicationAccessToken, communicationUserIdentifier });
    return oneSignalRegistrationToken;
}

// Registration tokens are exchanged for ACS access tokens, so they must not be guessable.
const generateGuid = function () {
    return crypto.randomUUID();
}

function parseJWT (token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

// Exchanging Azure AD access token of a Teams User for a Communication access token
// https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/manage-teams-identity?pivots=programming-language-javascript
const getACSAccessTokenInfo = async (aadToken, userObjectId) => {
    let acsToken;
    try{
        acsToken = await communicationIdentityClient.getTokenForTeamsUser({
            teamsUserAadToken: aadToken,
            clientId,
            userObjectId: userObjectId
        });
    } catch(e) {
        console.log('ERROR', e);
        throw e
    }
    
    let parsedToken = parseJWT(acsToken.token);
    if (parsedToken == '') {
        throw (" Parsed Token is empty");
    }
    const mri = `8:${parsedToken.skypeid}`;
    const tokenResponse = {
        token: acsToken.token,
        userId: { communicationUserId: mri }
    };
    return tokenResponse;
}

// This server holds the ACS resource connection string, so any route that mints tokens or
// manages rooms must first prove the caller owns the identity/room it is asked to act on.
// Sessions are held server-side and keyed by an opaque HttpOnly cookie.
const SESSION_COOKIE_NAME = 'acsSampleSession';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;
const MAX_ROOM_PARTICIPANTS = 50;
const ROOM_ROLES = new Set(['Presenter', 'Collaborator', 'Attendee', 'Consumer']);
const sessions = new Map();

const pruneSessions = () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.createdAt > SESSION_TTL_MS) {
            sessions.delete(id);
        }
    }
    while (sessions.size > MAX_SESSIONS) {
        sessions.delete(sessions.keys().next().value);
    }
};

const readSessionId = (req) => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return undefined;
    }
    for (const pair of cookieHeader.split(';')) {
        const separatorIndex = pair.indexOf('=');
        if (separatorIndex !== -1 && pair.slice(0, separatorIndex).trim() === SESSION_COOKIE_NAME) {
            return pair.slice(separatorIndex + 1).trim();
        }
    }
    return undefined;
};

const getSession = (req) => {
    pruneSessions();
    const sessionId = readSessionId(req);
    return sessionId ? sessions.get(sessionId) : undefined;
};

const startSession = (req, res) => {
    const existingSession = getSession(req);
    if (existingSession) {
        return existingSession;
    }
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const session = { createdAt: Date.now(), acsUserIds: new Set(), roomIds: new Set() };
    sessions.set(sessionId, session);
    pruneSessions();
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    // SameSite=Strict is what keeps these cookie-authorized, state-changing routes from being CSRF-able.
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}`);
    return session;
};

// A caller may manage a room it created through this server, or one where an identity it
// owns is already a Presenter.
const isAuthorizedForRoom = async (roomsClient, session, roomId) => {
    if (session.roomIds.has(roomId)) {
        return true;
    }
    try {
        for await (const participant of roomsClient.listParticipants(roomId)) {
            if (participant.role === 'Presenter' && session.acsUserIds.has(participant.id?.communicationUserId)) {
                return true;
            }
        }
    } catch (e) {
        console.error('Failed to verify room membership', e);
    }
    return false;
};

const path = require('path');

// Base configuration shared between ESM and UMD builds
const baseConfig = {
    devtool: 'inline-source-map',
    mode: 'development',
    entry: "./src/index.js",
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.(ts|tsx)?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: "html-loader"
                    }
                ]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    }
};

// ESM bundle configuration (production)
const esmConfig = {
    ...baseConfig,
    name: 'esm',
    output: {
        filename: 'bundle.js',
        chunkFilename: '[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist/esm'),
        publicPath: 'auto',
        module: true,
        library: {
            type: 'module'
        },
        environment: {
            module: true,
            dynamicImport: true
        }
    },
    experiments: {
        outputModule: true
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./public/index.html",
            filename: "../index.html",
            inject: false
        })
    ]
};

// UMD bundle configuration (production)
const umdConfig = {
    ...baseConfig,
    name: 'umd',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist/umd'),
        publicPath: 'auto'
    },
    module: {
        ...baseConfig.module,
        parser: {
            javascript: {
                dynamicImportMode: 'eager'
            }
        }
    },
    optimization: {
        splitChunks: false
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./public/index.html",
            filename: "../index.html",
            inject: false
        })
    ]
};

// comment devServer.webSocketServer: false to enable hot reloading
// Dev server settings (shared across all compilers)
const devServerSettings = {
    open: true,
    port: PORT,
    static:'./public',
    allowedHosts:[
        '.azurewebsites.net'
    ],
    webSocketServer: false,
    setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
            throw new Error('webpack-dev-server is not defined');
        }

        devServer.app.use(bodyParser.json());
        devServer.app.post('/getCommunicationUserToken', async (req, res) => {
            try {
                const session = startSession(req, res);
                const communicationUserId = req.body.communicationUserId;
                const isJoinOnlyToken = req.body.isJoinOnlyToken === true;
                let CommunicationUserIdentifier;
                if (!communicationUserId) {
                    CommunicationUserIdentifier = await communicationIdentityClient.createUser();
                    session.acsUserIds.add(CommunicationUserIdentifier.communicationUserId);
                } else if (typeof communicationUserId === 'string' && session.acsUserIds.has(communicationUserId)) {
                    CommunicationUserIdentifier = { communicationUserId: communicationUserId };
                } else {
                    // Minting a token for an arbitrary identity would let any caller impersonate it.
                    res.status(403).json({ message: 'This session does not own the requested ACS identity. Request a new identity, or sign in with an access token you already hold.' });
                    return;
                }
                const communicationUserToken = await communicationIdentityClient.getToken(CommunicationUserIdentifier, [isJoinOnlyToken ? "voip.join" : "voip"]);
                let oneSignalRegistrationToken;
                if (config.functionAppOneSignalTokenRegistrationUrl) {
                    oneSignalRegistrationToken = await registerCommunicationUserForOneSignal(communicationUserToken, CommunicationUserIdentifier);
                }
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({communicationUserToken, oneSignalRegistrationToken, userId: CommunicationUserIdentifier });
            } catch (e) {
                console.log('Error setting registration token', e);
                res.sendStatus(500);
            }
        });
        devServer.app.post('/getCommunicationUserTokenForOneSignalRegistrationToken', async (req, res) => {
            try {
                const oneSignalRegistrationToken = req.body.oneSignalRegistrationToken;
                const { communicationUserToken, communicationUserIdentifier } = oneSignalRegistrationTokenToAcsUserAccesTokenMap.get(oneSignalRegistrationToken);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({ communicationUserToken, userId: communicationUserIdentifier, oneSignalRegistrationToken });
            } catch (e) {
                console.log('Error setting registration token', e);
                res.sendStatus(500);
            }
        });
        devServer.app.post('/getOneSignalRegistrationTokenForCommunicationUserToken', async (req, res) => {
            try {
                const communicationUserToken = {token: req.body.token };
                const communicationUserIdentifier = { communicationUserId: req.body.communicationUserId };

                if (!config.functionAppOneSignalTokenRegistrationUrl) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({
                        communicationUserToken, userId: communicationUserIdentifier 
                    });
                    return;
                }

                let pair = [...oneSignalRegistrationTokenToAcsUserAccesTokenMap.entries()].find((pair) => {
                    return pair[1].token === communicationUserToken.token &&
                        pair[1].communicationUserId === communicationUserIdentifier.communicationUserId;
                });
                let oneSignalRegistrationToken;
                if (pair) {
                    oneSignalRegistrationToken = pair[0];
                } else {
                    oneSignalRegistrationToken = await registerCommunicationUserForOneSignal(communicationUserToken, communicationUserIdentifier);
                }
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({
                    communicationUserToken,
                    userId: communicationUserIdentifier,
                    oneSignalRegistrationToken
                });
            } catch (e) {
                console.log('Error setting registration token', e);
                res.sendStatus(500);
            }
        });
        devServer.app.post('/teamsPopupLogin', async (req, res) => {
            try {
                const aadToken = req.body.aadToken;
                const userObjectId = req.body.userObjectId;
                let acsTokenInfo = await getACSAccessTokenInfo(aadToken, userObjectId);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({
                    communicationUserToken: {token: acsTokenInfo.token},
                    userId: acsTokenInfo.userId
                });
            } catch (e) {
                console.error(e);
                res.sendStatus(400);
            }
        });
        devServer.app.get('/entraConfig', async (req, res) => {
            try {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json(entraCredentialConfig);
            } catch (e) {
                console.error(e);
                res.sendStatus(400);
            }
        });
        devServer.app.post('/teamsM365Login', async (req, res) => {
            try {
                const email = req.body.email;
                const password = req.body.password;
            
                const pca = new msal.PublicClientApplication(authConfig.configuration);
                let tokenRequest = {scopes: authConfig.scopes.m365Login}

                tokenRequest.username = email;
                tokenRequest.password = password;
                const response = await pca.acquireTokenByUsernamePassword(tokenRequest);
                let acsTokenInfo = await getACSAccessTokenInfo(response.accessToken, response.uniqueId);
            
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({
                    communicationUserToken: {token: acsTokenInfo.token},
                    userId: acsTokenInfo.userId
                });
            } catch (e) {
                console.error(e);
                res.sendStatus(400);
            }
        });
        devServer.app.get('/authConfig', async (req, res) => {
            try {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json(authConfig);
            } catch (e) {
                console.error(e);
                res.sendStatus(400);
            }
        });
        devServer.app.get('/blank', async (req, res) => {
            res.status(200).send('');
        });
        devServer.app.post('/createRoom', async (req, res) => {
            try {
                const session = getSession(req);
                if (!session || session.acsUserIds.size === 0) {
                    res.status(401).json({ message: 'Provision an ACS identity from this app before creating a room.' });
                    return;
                }
                let participants = [];
                let invalidParticipant = false;
                const addParticipants = (userIds, role) => {
                    if (!Array.isArray(userIds)) {
                        return;
                    }
                    userIds.forEach(userId => {
                        if (typeof userId !== 'string' || !userId.trim()) {
                            invalidParticipant = true;
                            return;
                        }
                        participants.push({
                            id: { communicationUserId: userId.trim() },
                            role
                        });
                    });
                };
                addParticipants(req.body.presenterUserIds, "Presenter");
                addParticipants(req.body.collaboratorUserIds, "Collaborator");
                addParticipants(req.body.attendeeUserIds, "Attendee");
                addParticipants(req.body.consumerUserIds, "Consumer");

                if (invalidParticipant) {
                    res.status(400).json({
                        message: "Every participant ID must be a non-empty string."
                    });
                    return;
                }

                if (participants.length === 0) {
                    res.status(400).json({
                        message: "At least one participant must be provided to create a room."
                    });
                    return;
                }

                if (participants.length > MAX_ROOM_PARTICIPANTS) {
                    res.status(400).json({
                        message: `A room cannot be created with more than ${MAX_ROOM_PARTICIPANTS} participants.`
                    });
                    return;
                }

                const validFrom = new Date(Date.now());
                const validUntil = new Date(validFrom.getTime() + 60 * 60 * 1000);
                const pstnDialOutEnabled = req.body.pstnDialOutEnabled === true;
                const roomsClient = new RoomsClient(config.connectionString);
                const createRoom = await roomsClient.createRoom({
                    validFrom,
                    validUntil,
                    pstnDialOutEnabled,
                    participants
                });
                const roomId = createRoom.id;
                session.roomIds.add(roomId);
                console.log('\nRoom successfully created');
                console.log('Room ID:', roomId);

                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({
                    roomId
                });
            } catch (e) {
                console.error(e);
                res.status(500).json({ message: 'Failed to create room.' });
            }
        });
        devServer.app.patch('/updateParticipant', async (req, res) => {
            try {
                const session = getSession(req);
                if (!session || session.acsUserIds.size === 0) {
                    res.status(401).json({ message: 'Provision an ACS identity from this app before updating a room.' });
                    return;
                }
                const roomId = req.body.patchRoomId;
                const participantId = req.body.patchParticipantId;
                const participantRole = req.body.patchParticipantRole;
                if (typeof roomId !== 'string' || !roomId.trim() ||
                    typeof participantId !== 'string' || !participantId.trim() ||
                    !ROOM_ROLES.has(participantRole)) {
                    res.status(400).json({ message: `Provide a room ID, a participant ID, and one of these roles: ${[...ROOM_ROLES].join(', ')}.` });
                    return;
                }
                const roomsClient = new RoomsClient(config.connectionString);
                if (!await isAuthorizedForRoom(roomsClient, session, roomId.trim())) {
                    res.status(403).json({ message: 'This session is not authorized to manage the requested room.' });
                    return;
                }
                const participant = [
                    {
                      id: { communicationUserId: participantId.trim() },
                      role: participantRole,
                    },
                  ];
                await roomsClient.addOrUpdateParticipants(roomId.trim(), participant);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({message: 'Participant updated successfully'});
            } catch (e) {
                console.error(e);
                res.status(500).json({ message: 'Failed to update participant.' });
            }
        });

        return middlewares;
    }
};

// Export configuration based on environment variable
// npm run build:esm -> ESM bundle
// npm run build:umd -> UMD bundle  
// npm run build -> Both bundles
// npm start -> Dev server (both ESM and UMD, switch via ?bundle=esm)
module.exports = (env, argv) => {
    if (env && env.esm) {
        return esmConfig;
    }
    if (env && env.umd) {
        return umdConfig;
    }
    if (env && env.all) {
        return [esmConfig, umdConfig];
    }
    // Default: dev server with both ESM and UMD bundles
    // Override publicPath to absolute (required by webpack-dev-server)
    const esmDevConfig = {
        ...esmConfig,
        output: {
            ...esmConfig.output,
            publicPath: '/esm/'
        }
    };
    const umdDevConfig = {
        ...umdConfig,
        output: {
            ...umdConfig.output,
            publicPath: '/umd/'
        },
        devServer: devServerSettings
    };
    return [esmDevConfig, umdDevConfig];
};
