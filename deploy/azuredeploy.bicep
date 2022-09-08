@description('Name of the AppService to create.')
param appName string

@description('The pricing tier for the hosting plan.')
@allowed([
  'F1'
  'D1'
  'B1'
  'B2'
  'B3'
  'S1'
  'S2'
  'S3'
  'P1'
  'P2'
  'P3'
  'P4'
])
param sku string = 'F1'

var appServicePlanPortalName = 'AppServicePlan-${appName}'
var packageUrl = 'https://github.com/Azure-Samples/communication-services-web-calling-tutorial/releases/latest/download/calling-tutorial-build.zip'
var location = resourceGroup().location

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
  ]
  properties: {
    serverFarmId: resourceId('Microsoft.Web/serverfarms', appServicePlanPortalName)
  }

  resource MSDeploy 'extensions@2022-03-01' = {
    name: 'MSDeploy'
    properties: {
      packageUri: packageUrl
    }
  }
}
