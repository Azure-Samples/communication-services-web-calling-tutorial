---
page_type: sample
languages:
- javascript
- nodejs
products:
- azure
- azure-communication-services
---

# ACS Calling Tutorial

## Prerequisites

1. [npm](https://www.npmjs.com/get-npm)
2. [Node.js](https://nodejs.org/en/download/)

## Code structure
* ./src: client side source code
* ./webpack.config.js: Project bundler. Has a simple local server for user token provisioning.
* ./serverConfig.json: configuration file for specifying the connection strings.

## Before running the sample for the first time
1. git clone https://github.com/Azure-Samples/communication-services-web-calling-tutorial
2. cd communication-services-web-calling-tutorial/Project
3. Get a connection string by provisioning an Azure Communication Services resource from the Azure portal. Use the connection string as value for key `connectionString` in serverConfig.json file.
4. npm install
5. npm run build
6. npm run start
7. Open localhost:5000 in a browser. (Supported browsers are Chrome, Edge Chromium, and Safari)

## Deploying to Azure App Service
- This app has been setup to be easily deployed to Azure App Service with a webpack dev-server
   - webpack.config.js.
      - allowedHosts: Specifies that it allows this app to be hosted in \<appname\>.azurewebsites.org which is how Azure App Service hosts web apps.
      - contentBase: The folder where public assets can be served from. For example, a request to your app like GET https://\<appname\>.azurewebsites.org/file.txt, will serve the file.txt that resides in the contentBase folder. This app has this field set to the './public' folder.
   - package.json
      - "start-local" script. This will start the server on local machine at port 5000.
      - "build-local" script. This will build the the application in development mode
      - "start" script. Used by Azure App Service when deploying. This will start server in port 8080. Port 8080 is specified in webpack.config.js. Do not change this port when deploying to Azrue App Service becaue this is the port that Azure App Service uses. 
    "build" script. Used by Azure App Service when deploying to build the application.

Note: If you want to deploy this application with a different deployment environment other than Azure App Service, you may need to change these configurations according to your deployment environment specifications.

## Troubleshooting
   - Make sure your ACS connecting string is specified in serverConfig.json or you wont be able to provision ACS User Access tokens for the app.
   - If any errors occur, check the browser console logs for errors. Also, check the webpack server side console logs for errors.
   - Web Push Notifications - In order to test web push notifications, we must run the app in HTTPS, hence you will need to deploy this app to a secured server that will serve the application with HTTPS. You will need to specify value in ./clientConfig.json for the key "oneSignalAppId". And you will need to specify value for "functionAppOneSignalTokenRegistrationUrl" in ./serverConfig.json. To learn how to set up a web push notification architecture for the ACS Web Calling SDK, please follow our [ACS Web Calling SDK - Web push notifications tutorial](https://github.com/Azure-Samples/communication-services-javascript-quickstarts/tree/main/calling-web-push-notifications):
## Resources

1. Documentation on how to use the ACS Calling SDK for Javascript can be found on https://docs.microsoft.com/en-gb/azure/communication-services/quickstarts/voice-video-calling/calling-client-samples?pivots=platform-web
2. ACS Calling SDK for Javascript API reference documentation can be found on https://docs.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/?view=azure-communication-services-js
3. Documentation on Communications Calling SDK with Teams identity can be found on https://learn.microsoft.com/en-us/azure/communication-services/concepts/teams-interop
4. Documentation on how to setup and get access tokens for teams User can be found on https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/manage-teams-identity?pivots=programming-language-javascript