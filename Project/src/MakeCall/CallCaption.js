import React, { useState, useEffect } from "react";
import { Features } from '@azure/communication-calling';

// CallCaption react function component
const CallCaption = ({ call, isTeamsUser }) => {
    // caption history state
    const [captionHistory, setCaptionHistory] = useState([]);
    let captions;

    useEffect(() => {
        captions = (isTeamsUser || (!isTeamsUser && call.info?.context === 'teamsMeetingJoin') ) ?
            call.feature(Features.TeamsCaptions) : call.feature(Features.Captions);
        startCaptions(captions);
        
        return () => {
            // cleanup
            captions.off('isCaptionsActiveChanged', isCaptionsActiveHandler);
            captions.off('captionsReceived', captionHandler);
        };
    }, []);

    const startCaptions = async () => {
        try {
            if (!captions.isCaptionsActive || !captions.isCaptionsFeatureActive) {
                await captions.startCaptions({ spokenLanguage: 'en-us' });
            }
            captions.on('isCaptionsActiveChanged', isCaptionsActiveHandler);
            captions.on('captionsReceived', captionHandler);
        } catch (e) {
            console.error('startCaptions failed', e);
        }
    };

    const isCaptionsActiveHandler = () => {
        console.log('isCaptionsActiveChanged: ', captions.isCaptionsActive);
    }

    const captionHandler = (captionData) => {
        let mri = '';
        if (captionData.speaker.identifier.kind === 'communicationUser') {
            mri = captionData.speaker.identifier.communicationUserId;
        } else if (captionData.speaker.identifier.kind === 'microsoftTeamsUser') {
            mri = captionData.speaker.identifier.microsoftTeamsUserId;
        } else if (captionData.speaker.identifier.kind === 'phoneNumber') {
            mri = captionData.speaker.identifier.phoneNumber;
        }

        const captionText = `${captionData.timestamp.toUTCString()}
                ${captionData.speaker.displayName}: ${captionData.text}`;

        console.log(mri, captionText);
        if (captionData.resultType === 'Final' || captionData.resultType === 1) {
            setCaptionHistory(oldCaptions => [...oldCaptions, captionText]);
        }

    };

    return (
        <div id="captionArea" className="caption-area">
            {
                captionHistory.map((caption, index) => (
                    <div key={index}>{caption}</div>
                ))
            }
        </div>
    );
};

export default CallCaption;