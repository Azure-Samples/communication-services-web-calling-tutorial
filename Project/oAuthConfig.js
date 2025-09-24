const authConfig = {
    configuration: {
        auth: {
            clientId: 'ENTER_CLIENT_ID',
            authority: 'https://login.microsoftonline.com/common'
        }
    },
    scopes: {
        m365Login: [
            "https://auth.msft.communication.azure.com/.default"
        ],
        popUpLogin: [
            "https://auth.msft.communication.azure.com/Teams.ManageCalls",
            "https://auth.msft.communication.azure.com/Teams.ManageChats"
        ]
    }
};

const entraCredentialConfig = {
    tenantId: 'ENTER_TENANT_ID',
    clientId: 'ENTER_CLIENT_ID',
    resourceEndpoint: 'ACS_RESOURCE_ENDPOINT' // e.g., 'https://contoso.unitedstates.communication.azure.com/'
};

module.exports = { authConfig, entraCredentialConfig }