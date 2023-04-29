const CommunicationIdentityClient = require("@azure/communication-identity").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./serverConfig.json");
const axios = require("axios");
const bodyParser = require('body-parser');
const CommunicationRelayClient = require('@azure/communication-network-traversal').CommunicationRelayClient;
const msal = require('@azure/msal-node');

const {authConfig, authScopes} = require('./oAuthConfig');
const clientId = authConfig.auth.clientId;


if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `serverConfig.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);

const PORT = process.env.port || 8080;


const oneSignalRegistrationTokenToAcsUserAccesTokenMap = new Map();
const registerCommunicationUserForOneSignal = async (communicationUserToken, userId) => {
    const oneSignalRegistrationToken = generateGuid();
    await axios({
        url: config.functionAppOneSignalTokenRegistrationUrl,
        method: 'PUT',
        headers: {
            'x-functions-key': config.functionAppOneSignalTokenRegistrationApiKey,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            communicationUserId: userId.communicationUserId,
            oneSignalRegistrationToken
        })
    }).then((response) => { return response.data });
    oneSignalRegistrationTokenToAcsUserAccesTokenMap.set(oneSignalRegistrationToken, communicationUserToken);
    return oneSignalRegistrationToken;
}

const generateGuid = function () {
    function s4() {
        return Math.floor((Math.random() + 1) * 0x10000).toString(16).substring(1);
    }
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

const parseJWT = (token) => {
    let [, payload] = token?.split(".");
    if (payload != undefined) {
        payload = payload.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(escape(atob(payload))));
    }
    return '';
}

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

module.exports = {
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
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./public/index.html",
            filename: "./index.html"
        })
    ],
    devServer: {
        open: true,
        port: PORT,
        contentBase:'./public',
        allowedHosts:[
            '.azurewebsites.net'
        ],
        before: function(app) {
            app.use(bodyParser.json());
            app.post('/getCommunicationUserToken', async (req, res) => {
                try {
                    const userId = await communicationIdentityClient.createUser();
                    const communicationUserToken = await communicationIdentityClient.getToken(userId, ["voip"]);
                    let oneSignalRegistrationToken;
                    if (config.functionAppOneSignalTokenRegistrationUrl && config.functionAppOneSignalTokenRegistrationApiKey) {
                        oneSignalRegistrationToken = await registerCommunicationUserForOneSignal(communicationUserToken, userId);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({communicationUserToken, oneSignalRegistrationToken, userId });
                } catch (e) {
                    console.log('Error setting registration token', e);
                    res.sendStatus(500);
                }
            });
            app.post('/getCommunicationUserTokenForOneSignalRegistrationToken', async (req, res) => {
                try {
                    const oneSignalRegistrationToken = req.body.oneSignalRegistrationToken;
                    const communicationUserToken = oneSignalRegistrationTokenToAcsUserAccesTokenMap.get(oneSignalRegistrationToken);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({ communicationUserToken, oneSignalRegistrationToken });
                } catch (e) {
                    console.log('Error setting registration token', e);
                    res.sendStatus(500);
                }
            });
            app.post('/getOneSignalRegistrationTokenForCommunicationUserToken', async (req, res) => {
                try {
                    const communicationUserToken = {
                        token: req.body.token,
                        user: { communicationUserId: req.body.communicationUserId }
                    };

                    if (!config.functionAppOneSignalTokenRegistrationApiKey) {
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).json({
                            communicationUserToken
                        });
                    }

                    let pair = [...oneSignalRegistrationTokenToAcsUserAccesTokenMap.entries()].find((pair) => {
                        return pair[1].token === communicationUserToken.token &&
                            pair[1].user.communicationUserId === communicationUserToken.user.communicationUserId;
                    });
                    let oneSignalRegistrationToken;
                    if (pair) {
                        oneSignalRegistrationToken = pair[0];
                    } else {
                        oneSignalRegistrationToken = await registerCommunicationUserForOneSignal(communicationUserToken);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({
                        communicationUserToken, 
                        oneSignalRegistrationToken
                    });
                } catch (e) {
                    console.log('Error setting registration token', e);
                    res.sendStatus(500);
                }
            });
            app.get('/customRelayConfig', async (req, res) => {
                console.log('Requesting custom TURN server configuration');
                try {
                    const relayClient = new CommunicationRelayClient(config.connectionString);
                    const relayConfig = await relayClient.getRelayConfiguration();
                    if (relayConfig) {
                        res.status(200).json({
                            relayConfig
                        });
                    } else {
                        throw 'No relay config returned from service';
                    }
                } catch (e) {
                    console.log(`Error creating custom TURN configuration: ${e}`);
                    res.sendStatus(500);
                }
            });
            app.post('/teamsPopupLogin', async (req, res) => {
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
            app.post('/teamsM365Login', async (req, res) => {
                try {
                    const email = req.body.email;
                    const password = req.body.password;
                
                    const pca = new msal.PublicClientApplication(authConfig);
                    let tokenRequest = {scopes: authScopes.m365Login}

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
        }
    }
};
