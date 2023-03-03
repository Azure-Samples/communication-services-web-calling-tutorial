
const CommunicationIdentityClient = require("@azure/communication-administration").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./serverConfig.json");
const axios = require("axios");
const bodyParser = require('body-parser');

if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `config.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);

const PORT = process.env.port || 8080;


const onSignalRegistrationTokenToAcsUserAccesTokenMap = new Map();

const generateGuid = function () {
    function s4() {
        return Math.floor((Math.random() + 1) * 0x10000).toString(16).substring(1);
    }
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
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
            app.post('/getAcsUserAccessToken', async (req, res) => {
                try {
                    const user = await communicationIdentityClient.createUser();
                    const acsUserAccessToken = await communicationIdentityClient.issueToken(user, ["voip"]);
                    let oneSignalRegistrationToken;
                    const registerForPushNotifications = req.body.registerForPushNotifications;
                    if (!!registerForPushNotifications) {
                        oneSignalRegistrationToken = generateGuid()
                        await axios({
                            url: config.functionAppOneSignalTokenRegistrationUrl,
                            method: 'PUT',
                            headers: {
                                'x-functions-key': config.functionAppOneSignalTokenRegistrationApiKey,
                                'Content-Type': 'application/json'
                            },
                            data: JSON.stringify({
                                communicationUserId: user.communicationUserId,
                                oneSignalRegistrationToken: oneSignalRegistrationToken
                            })
                        }).then((response) => { return response.data });
                        onSignalRegistrationTokenToAcsUserAccesTokenMap.set(oneSignalRegistrationToken, acsUserAccessToken);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({
                        acsUserAccessToken: acsUserAccessToken.token,
                        user: acsUserAccessToken.user,
                        oneSignalRegistrationToken
                    });
                } catch (e) {
                    console.log('Error setting registration token', e);
                    res.sendStatus(500);
                }
            });
            app.post('/getAcsUserAccessTokenForOneSignalRegistrationToken', async (req, res) => {
                try {
                    const oneSignalRegistrationToken = req.body.oneSignalRegistrationToken;
                    const acsUserAccessToken = onSignalRegistrationTokenToAcsUserAccesTokenMap.get(oneSignalRegistrationToken);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({ acsUserAccessToken: acsUserAccessToken.token, user: acsUserAccessToken.user, oneSignalRegistrationToken });
                } catch (e) {
                    console.log('Error setting registration token', e);
                    res.sendStatus(500);
                }
            });
        }
    }
};
