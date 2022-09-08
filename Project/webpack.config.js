
const CommunicationIdentityClient = require("@azure/communication-administration").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

let communicationIdentityClient = null;
const getCommunicationIdentityClient = () => {
    if (communicationIdentityClient != null) {
        return communicationIdentityClient;
    }
    let config;
    try {
        config = require('./config.json');
    } catch (error) {
        return null;
    }
    const isValidConnectionString = config && config.connectionString && config.connectionString.indexOf('endpoint=') > -1; 
    if (isValidConnectionString) {
        communicationIdentityClient = new CommunicationIdentityClient(config.connectionString);
        return communicationIdentityClient;
    }
    console.error("Cannot use custom Communication Service. Update `config.json` with connection string");
    return null;
}

const env = process.env;
env.development = false;

const PORT = env.port || 9000;

const isProd = env.development == null || 
    !env.development || 
    env.development == 'false' || 
    (env.production != null && 
        (env.production == true || env.production == 'true'));

module.exports = {
    ...(isProd ? {} : { devtool: 'eval-source-map' }),
    mode: isProd ? 'production' : 'development',
    entry: "./src/index.js",
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'build.js'
    },
    resolve: {
        extensions: ['.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: [/dist/, /node_modules/],
                use: {
                    loader: "babel-loader"
                }
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
        }),
        new CopyWebpackPlugin({ patterns: [{ 
            from: path.resolve(__dirname, 'web.config'), 
            to: path.resolve(__dirname, 'dist') 
        }]})
    ],
    devServer: {
        open: true,
        hot: true,
        port: PORT,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        },
        onBeforeSetupMiddleware: function(devServer) {
            devServer.app.post('/tokens/provisionUser', async (req, res) => {
                // Check if the communication identity client has been configured.
                const identityClient = getCommunicationIdentityClient();
                if (identityClient == null) {
                    const message = 'Cannot use custom communication service. Defaulting to publicly available resource.';
                    res.status(503);
                    res.json({ message })
                    console.error(message);
                    return;
                }

                // Create user and return token
                try {
                    let communicationUserId = await identityClient.createUser();
                    const tokenResponse = await identityClient.issueToken(communicationUserId, ["voip"]);
                    res.json(tokenResponse);
                } catch (error) {
                    console.error(error);
                    res.status(503);
                    res.json({ message });
                }
            });
        }
    }
};
