@description('Name of the AppService to create.')
param appName string

@description('The SKU of App Service Plan.')
param sku string = 'F1'

var appServicePlanPortalName = 'AppServicePlan-${appName}'
var packageUrl = 'https://github.com/Azure-Samples/communication-services-web-calling-tutorial/releases/latest/download/calling-tutorial-build.zip'
var commsName = 'CommunicationServices-${appName}'
var location = resourceGroup().location

resource ACS 'Microsoft.Communication/communicationServices@2020-08-20' = {
  name: commsName
  location: 'global'
  properties: {
    dataLocation: 'United States'
  }
}

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanPortalName
  location: location
  sku: {
    name: sku
  }
  properties: {}
}

resource site 'Microsoft.Web/sites@2022-03-01' = {
  name: appName
  location: location
  dependsOn: [
    serverFarm
    ACS
  ]
  properties: {
    serverFarmId: resourceId('Microsoft.Web/serverfarms', appServicePlanPortalName)
  }

  resource appsettings 'config@2022-03-01' = {
    name: 'appsettings'
    properties: {
      ResourceConnectionString: listkeys(commsName, '2020-08-20-preview').primaryConnectionString
      WEBSITE_NODE_DEFAULT_VERSION: '~14'
    }
  }

  resource MSDeploy 'extensions@2022-03-01' = {
    name: 'MSDeploy'
    dependsOn: [appsettings]
    properties: {
      packageUri: packageUrl
    }
  }
}
