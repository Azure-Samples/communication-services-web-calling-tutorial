import {
    isCommunicationUserIdentifier,
    isPhoneNumberIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier
} from '@azure/communication-common';

export const utils = {
    getAppServiceUrl: () => {
        return window.location.origin;
    },
    provisionNewUser: async (userId) => {
        const request = {
            method: 'POST',
            body: JSON.stringify({ userId }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
        };
        
        // Try the local server
        try {
            const response = await fetch('/tokens/provisionUser', request);
            if (response.ok) {
                return response.json();
            }
        } catch (error) {}

        console.warn('Could not get token from custom Communications Service. Trying publicly available service.');

        // If that does not work, try the public version
        try {
            const response = await fetch('https://calling-example-er.azurewebsites.net/tokens/provisionUser', request);
            if (response.ok) {
                return response.json();
            }
        } catch (error) {}

        new Error('Invalid token response');
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
