//const CommunicationIdentityClient =
//  require("@azure/communication-administration").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const fetch = require("node-fetch");
// const config = require("./config.json");
// if (
//   !config ||
//   !config.connectionString ||
//   config.connectionString.indexOf("endpoint=") === -1
// ) {
//   throw new Error("Update `config.json` with connection string");
// }

// const communicationIdentityClient = new CommunicationIdentityClient(
//   config.connectionString
// );
const PORT = process.env.port || 8080;

module.exports = {
  devtool: "inline-source-map",
  mode: "development",
  entry: "./src/index.js",
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader",
          },
        ],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: "./public/index.html",
      filename: "./index.html",
    }),
  ],
  devServer: {
    open: true,
    port: PORT,
    before: function (app) {
      app.post("/tokens/provisionUser", async (req, res) => {
        try {
          //  let communicationUserId =
          //    await communicationIdentityClient.createUser();
          //  const tokenResponse = await communicationIdentityClient.issueToken(
          //    communicationUserId,
          //    ["voip"]
          //  );
          //  res.json(tokenResponse);
          const tokenUrl =
            "https://ucs-acs-tokens.azurewebsites.net/api/GetACSToken?code=jh7zsgJlspF8sCXc2Q5U6bU88zV2NJBydz4MXJPJv5klGhs45CZdTA==";
          const response = await fetch(tokenUrl);
          const data = await response.json();
          const { token } = data.value.accessToken;

          res.json({
            user: {
              communicationUserId: `testRTC ${Math.random()
                .toString(32)
                .substr(2)}`,
            },
            token: token,
          });
        } catch (error) {
          console.log("error", error);
        }
      });
    },
  },
};
