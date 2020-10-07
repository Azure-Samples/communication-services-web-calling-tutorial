# ACS Calling Tutorial

## Prerequisites

1. [npm](https://www.npmjs.com/get-npm)
2. [Node.js](https://nodejs.org/en/download/)

## Code structure

* ./src: client side source code
* ./webpack.config.js: Project bundler. Has a simple local server for user token provisioning.
* ./config.json: configuration file for specifying the connectiong string.

## Before running the sample for the first time
1. git clone https://github.com/Azure-Samples/communication-services-web-calling-tutorial
2. cd communication-services-web-calling-tutorial/Project
3. Get a connection string by provisioning an Azure Communication Services resource from the Azure portal. Use the connection string as value for key `connectionString` in config.json file.
4. npm install
5. npm run build
6. npm run start
7. Open localhost:5000 in a browser. (Supported browsers are Chrome, Edge Chromium, and Safari)

## Resources

1. Documentation on how to use the ACS Calling SDK for Javascript can be found on https://docs.microsoft.com/en-gb/azure/communication-services/quickstarts/voice-video-calling/calling-client-samples?pivots=platform-web
2. ACS Calling SDK for Javascript API reference documentation can be found on https://docs.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/?view=azure-communication-services-js
