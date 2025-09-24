import {
    isCommunicationUserIdentifier,
    isPhoneNumberIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier,
    AzureCommunicationTokenCredential
} from '@azure/communication-common';
import { InteractiveBrowserCredential } from '@azure/identity';
import { PublicClientApplication } from "@azure/msal-browser";
import axios from 'axios';

export const utils = {
    getAppServiceUrl: () => {
        return window.location.origin;
    },
    getCommunicationUserToken: async (communicationUserId, isJoinOnlyToken) => {
        let data = {};
        if (communicationUserId) {
            data.communicationUserId = communicationUserId;
        }
        if (isJoinOnlyToken) {
            data.isJoinOnlyToken = isJoinOnlyToken;
        }
        let response = await axios({
            url: 'getCommunicationUserToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(data)
        })
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Failed to get ACS User Access token');
    },
    getCommunicationUserTokenForOneSignalRegistrationToken: async (oneSignalRegistrationToken) => {
        let response = await axios({
            url: 'getCommunicationUserTokenForOneSignalRegistrationToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({oneSignalRegistrationToken})
        });
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Failed to get ACS User Acccess token for the given OneSignal Registration Token');
    },
    getOneSignalRegistrationTokenForCommunicationUserToken: async (token, communicationUserId) => {
        let response = await axios({
            url: 'getOneSignalRegistrationTokenForCommunicationUserToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({token, communicationUserId})
        });
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Failed to get ACS User Acccess token for the given OneSignal Registration Token');
    },
    teamsPopupLogin: async () => {
        /* 
        Ideally authConfig could be stored in a config file or environment variable:
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
        */
        const fetchAuthConfig = async () => {
            const response = await axios({
                url: 'authConfig',
                method: 'GET'
            });
            if (response.status !== 200) {
                throw new Error('Failed to get auth configs');
            }
            return response.data;
        }
        const authConfig = await fetchAuthConfig();

        const oAuthObj = new PublicClientApplication(authConfig.configuration);
        const popupLoginResponse = await oAuthObj.loginPopup({scopes: authConfig.scopes.popUpLogin});
        const response = await axios({
            url: 'teamsPopupLogin',
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-type': 'application/json'
            },
            data: JSON.stringify({
                aadToken: popupLoginResponse.accessToken,
                userObjectId: popupLoginResponse.uniqueId
            })
        });
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Failed to get Teams User Acccess token');
    },
    teamsM365Login: async (email, password) => {
        const response = await axios({
            url: 'teamsM365Login',
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-type': 'application/json'
            },
            data: JSON.stringify({email, password })
        })
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Failed to get Teams User Acccess token');
    },
    entraUserLogin: async () => {
        /* 
        Ideally entraCredentialConfig could be stored in a config file or environment variable:
            const entraCredentialConfig = {
                tenantId: 'ENTER_TENANT_ID',
                clientId: 'ENTER_CLIENT_ID',
                resourceEndpoint: 'ACS_RESOURCE_ENDPOINT' // e.g., 'https://contoso.unitedstates.communication.azure.com/'
            };
        */
        const fetchEntraConfig = async () => {
            const response = await axios({
                url: 'entraConfig',
                method: 'GET'
            });
            if (response.status !== 200) {
                throw new Error('Failed to get entra configs');
            }
            return response.data;
        }
        const entraCredentialConfig = await fetchEntraConfig();

        const tokenCredential = new InteractiveBrowserCredential({
            redirectUri: window.location.href, // e.g., 'http://localhost:3000'
            ...entraCredentialConfig
        });
        const credential = new AzureCommunicationTokenCredential({
            tokenCredential: tokenCredential,
            resourceEndpoint: entraCredentialConfig.resourceEndpoint
        });
        const tokenResponse = await credential.getToken();
        // hack: getting the identifier needs to become a public API on the credential
        const parsedToken = JSON.parse(atob(tokenResponse.token.split('.')[1]));
        const communicationUserId = `8:${parsedToken.skypeid}`;
        return { communicationUserToken: tokenResponse, userId: { communicationUserId } };
    },
    createRoom: async (pstnDialOutEnabled, presenterUserIds, collaboratorUserIds, attendeeUserIds, consumerUserIds) => {
        try {
            const data = {};
            data.pstnDialOutEnabled = pstnDialOutEnabled;
            if (presenterUserIds) {
                data.presenterUserIds = presenterUserIds.split(',').map(id => id.trim());
            }
            if (collaboratorUserIds) {
                data.collaboratorUserIds = collaboratorUserIds.split(',').map(id => id.trim());
            }
            if (attendeeUserIds) {
                data.attendeeUserIds = attendeeUserIds.split(',').map(id => id.trim());
            }
            if (consumerUserIds) {
                data.consumerUserIds = consumerUserIds.split(',').map(id => id.trim());
            }

            const response = await axios({
                url: 'createRoom',
                method: 'POST',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-type': 'application/json'
                },
                data: JSON.stringify(data)
            });
            console.log('Room created successfully:', response.data);
            return response.data.roomId;

        } catch (error) {
            console.error('Error creating room:', error);
            throw error.response.data.message;
        }
    },
    updateParticipant: async (patchRoomId, patchParticipantId, patchParticipantRole) => {
        try {
            if (!patchRoomId.trim() || !patchParticipantId.trim() || !patchParticipantRole.trim()) {
                throw new Error('All parameters (patchRoomId, patchParticipantId, patchParticipantRole) must be non-empty strings without trailing whitespace.');
            }

            const response = await axios({
            url: 'updateParticipant',
            method: 'PATCH',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-type': 'application/json'
            },
            data: JSON.stringify({ 
                patchRoomId: patchRoomId.trim(), 
                patchParticipantId: patchParticipantId.trim(), 
                patchParticipantRole: patchParticipantRole.trim() 
            })
            });
            console.log('Participant updated successfully:', response.data);
        } catch (error) {
            console.error('Error updating participant:', error);
            throw error.response?.data?.message || error.message;
        }
    },
    getIdentifierText: (identifier) => {
        if (isCommunicationUserIdentifier(identifier)) {
            return identifier.communicationUserId;
        } else if (isPhoneNumberIdentifier(identifier)) {
            return identifier.phoneNumber;
        } else if (isMicrosoftTeamsUserIdentifier(identifier)) {
            return identifier.microsoftTeamsUserId;
        } else if (isUnknownIdentifier(identifier) && identifier.id === '8:echo123'){
            return 'Echo Bot';
        } else {
            return 'Unknown Identifier';
        }
    },
    getSizeInBytes(str) {
        return new Blob([str]).size;
    },
    getRemoteParticipantObjFromIdentifier(call, identifier) {
        switch(identifier.kind) {
            case 'communicationUser': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.communicationUserId === identifier.communicationUserId
                });
            }
            case 'microsoftTeamsUser': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.microsoftTeamsUserId === identifier.microsoftTeamsUserId
                });
            }
            case 'phoneNumber': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.phoneNumber === identifier.phoneNumber
                });
            }
            case 'unknown': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.id === identifier.id
                });
            }
        }
    },
    isParticipantSpotlighted(participantId, spotlightState) {
        if (!participantId || !spotlightState) { return false }
        let rtn = spotlightState.find(element => this.getIdentifierText(element.identifier) === this.getIdentifierText(participantId));
        return !!rtn
        
    },
    isParticipantHandRaised(participantId, raisedHandState) {
        if (!participantId || !raisedHandState) { return false }
        let rtn = raisedHandState.find(element => this.getIdentifierText(element.identifier) === this.getIdentifierText(participantId));
        return !!rtn
    },
    getParticipantPublishStates(participantId, publishedStates) {
        let states = {isSpotlighted: false, isHandRaised: false}
        states.isSpotlighted = this.isParticipantSpotlighted(participantId, publishedStates.spotlight)
        states.isHandRaised = this.isParticipantHandRaised(participantId, publishedStates.raiseHand)
        return states
    }
}
