// Environment options: 'commercial' or 'gcch' (Government Community Cloud High)
const environment = 'gcch'; // Set to 'commercial' for commercial accounts

// Authority endpoints by environment
const authorityEndpoints = {
    commercial: 'https://login.microsoftonline.com/common',
    gcch: 'https://login.microsoftonline.us/fef24bbe-18d9-453d-a4c9-3471d278af0c' // GCCH requires tenant-specific authority
};

const authConfig = {
    configuration: {
        auth: {
            clientId: 'ENTER_CLIENT_ID',
            authority: authorityEndpoints[environment]
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

module.exports = { authConfig, entraCredentialConfig, environment }