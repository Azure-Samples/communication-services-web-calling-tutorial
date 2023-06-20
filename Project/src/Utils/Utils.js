import {
    isCommunicationUserIdentifier,
    isPhoneNumberIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier,
    createIdentifierFromRawId
} from '@azure/communication-common';
import { PublicClientApplication } from "@azure/msal-browser";
import { authConfig, authScopes } from "../../oAuthConfig"
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
    teamsPopupLogin: async () => {
        const oAuthObj = new PublicClientApplication(authConfig);
        const popupLoginRespoonse = await oAuthObj.loginPopup({scopes: authScopes.popUpLogin});
        const response = await axios({
            url: 'teamsPopupLogin',
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-type': 'application/json'
            },
            data: JSON.stringify({
                aadToken: popupLoginRespoonse.accessToken,
                userObjectId: popupLoginRespoonse.uniqueId
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
    },
    bwVideoStream(stream) {
        let width = 1280, height = 720;
        const videoElem = document.createElement("video");
        videoElem.srcObject = stream;
        videoElem.height = height;
        videoElem.width = width;
        videoElem.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        canvas.width = width;
        canvas.height = height;
        

        const FPS = 30;
        function processVideo() {
            try {
                let begin = Date.now();
                // start processing.
                ctx.filter = "grayscale(1)";
                ctx.drawImage(videoElem, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                ctx.putImageData(imageData, 0, 0);              
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                setTimeout(processVideo, delay)
                ;
            } catch (err) {
                console.error(err);
            }
        };

        // schedule the first one.
        setTimeout(processVideo, 0);
        return canvas.captureStream(FPS);
    },
    dummyStream() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        canvas.width = 1280;
        canvas.height = 720;
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const colors = ['red', 'yellow', 'green'];
        const FPS = 30;
        function createShapes() {
            try {
                let begin = Date.now();
                // start processing.
                if (ctx) {
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    const x = Math.floor(Math.random() * canvas.width);
                    const y = Math.floor(Math.random() * canvas.height);
                    const size = 100;
                    ctx.fillRect(x, y, size, size);
                }            
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                setTimeout(createShapes, delay);
            } catch (err) {
                console.error(err);
            }
        };

        // schedule the first one.
        setTimeout(createShapes, 0);
        return canvas.captureStream(FPS);
    }
}
