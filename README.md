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
This is a sample application to show how one can use the `azure@communication-calling` package to build a calling experience. The client-side application is a React based user interface.  

## Prerequisites

1. [npm](https://www.npmjs.com/get-npm)
2. [Node.js (v14)](https://nodejs.org/en/download/)
3.  Create an Azure account with an active subscription. For details, see [Create an account for free](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
4. Create an Azure Communication Services resource. For details, see [Create an Azure Communication Resource](https://docs.microsoft.com/azure/communication-services/quickstarts/create-communication-resource). You'll need to record your resource **connection string** for this quickstart.

## Code structure

* [`./Project/src`](./Project/src): Client side source code
* [`./Project/src/app/App.js`](./Project/src/app/App.js): Entry point into the client source code 
* [`./Project/webpack.config.js`](./Project/webpack.config.js): Project bundler. Has a simple local server for user token provisioning.
* [`./Project/config.json`](./Project/config.json): configuration file for specifying the connectiong string.

## Before running the sample for the first time
1. git clone https://github.com/Azure-Samples/communication-services-web-calling-tutorial
2. cd communication-services-web-calling-tutorial/Project
3. Get a connection string by provisioning an Azure Communication Services resource from the Azure portal. Use the connection string as value for key `connectionString` in config.json file.

## Local Run
1. Open a command prompt in the `Project` folder
2. npm install
3. npm run build
4. npm run start
7. Open localhost:5000 in a browser. (Supported browsers are Chrome, Edge Chromium, and Safari)

## Deployment to Azure from VS Code
1. Download the [Azure Plugin](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureresourcegroups) and the [Azure Static Web App Plugin](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurestaticwebapps) for VS Code.
2. In the Azure plugin pane, click `+`, and click `Create Static Web App`.
3. 


## Resources

1. Documentation on how to use the ACS Calling SDK for Javascript can be found on https://docs.microsoft.com/en-gb/azure/communication-services/quickstarts/voice-video-calling/calling-client-samples?pivots=platform-web
2. ACS Calling SDK for Javascript API reference documentation can be found on https://docs.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/?view=azure-communication-services-js
