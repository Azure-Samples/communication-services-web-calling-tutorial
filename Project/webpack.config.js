
const CommunicationIdentityClient = require("@azure/communication-administration").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./serverConfig.json");
const axios = require("axios");
const bodyParser = require('body-parser');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const CommunicationRelayClient = require('@azure/communication-network-traversal').CommunicationRelayClient;

if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `config.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);

const PORT = process.env.port || 8080;


const oneSignalRegistrationTokenToAcsUserAccesTokenMap = new Map();
const registerCommunicationUserForOneSignal = async (communicationUserToken) => {
    const oneSignalRegistrationToken = generateGuid();
    await axios({
        url: config.functionAppOneSignalTokenRegistrationUrl,
        method: 'PUT',
        headers: {
            'x-functions-key': config.functionAppOneSignalTokenRegistrationApiKey,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            communicationUserId: communicationUserToken.user.communicationUserId,
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

// An example proxy server config
const processUrl = (originalUrl) => {
    const urlRegExp = new RegExp(`(proxy[:0-9]*)/(.*)$`);
    const matches = originalUrl.match(urlRegExp);
    if (!matches || matches.length < 3) {
      return originalUrl;
    }
    const returnUrl = `https://${matches[2]}`;
    console.log(`Proxying ${originalUrl} to ${returnUrl}`)
    return returnUrl;
};

const proxyRouter = (req) => {
    if (!req.originalUrl && !req.url) {
        return '';
    }
    return processUrl(req.originalUrl || req.url);
};

const useProxy = createProxyMiddleware({
    router: proxyRouter,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    ignorePath: true,
    ws: true,
    logLevel: 'debug'
});

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
        // https: true,
        before: function(app) {
            app.use(bodyParser.json());
            app.use('/proxy', cors(), useProxy);
            app.post('/getCommunicationUserToken', async (req, res) => {
                try {
                    const communicationUserIdentifier = await communicationIdentityClient.createUser();
                    const communicationUserToken = await communicationIdentityClient.issueToken(communicationUserIdentifier, ["voip"]);
                    let oneSignalRegistrationToken;
                    if (config.functionAppOneSignalTokenRegistrationUrl && config.functionAppOneSignalTokenRegistrationApiKey) {
                        oneSignalRegistrationToken = await registerCommunicationUserForOneSignal(communicationUserToken);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({communicationUserToken, oneSignalRegistrationToken });
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
        }
    }
};
