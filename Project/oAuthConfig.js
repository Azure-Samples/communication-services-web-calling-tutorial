const authConfig = {
    auth: {
            clientId: '5ea2529c-3327-47e0-a362-c75a829fb6f2',
            authority: 'https://login.microsoftonline.com/bc61f4fc-26d7-411e-91a9-4c14691dabdf'
        }
};
 // Add here scopes for id token to be used at MS Identity Platform endpoints.
 const authScopes = {
    popUpLogin: ["https://auth.msft.communication.azure.com/Teams.ManageCalls", "https://auth.msft.communication.azure.com/Teams.ManageChats"],
    m365Login: ['https://auth.msft.communication.azure.com/.default']
};

module.exports = {authConfig, authScopes }