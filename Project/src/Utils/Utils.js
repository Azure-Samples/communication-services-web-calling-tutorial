import {
    isCommunicationUserIdentifier,
    isPhoneNumberIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier
} from '@azure/communication-common';
import axios from 'axios';

export const utils = {
    getAppServiceUrl: () => {
        return window.location.origin;
    },
    getCommunicationUserToken: async () => {
        let response = await axios({
            url: 'getCommunicationUserToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
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
    }
}
