
const HtmlWebPackPlugin = require("html-webpack-plugin");
const path = require('path');

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
    entry: "./src/index.jsx",
    output: {
        path: path.join(__dirname, isProd ? 'dist/build': 'dist'),
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
        })
    ],
    devServer: {
        open: true,
        hot: true,
        port: PORT,
        proxy: [{
            path: '/tokens/provisionUser',
            target: 'http://[::1]:8080'
        }]
    }
};
