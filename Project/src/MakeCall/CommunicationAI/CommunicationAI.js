import React, { useState, useEffect } from "react";
import { Features, ResultType } from '@azure/communication-calling';
import { Dropdown } from '@fluentui/react/lib/Dropdown';


const CommunicationAI = ({ call }) => {
    const [captionsStarted, setCaptionsStarted] = useState(false)
    const [captionHistory, setCaptionHistory] = useState([]);
    const [lastSummary, setlastSummary] = useState("");
    const [lastfeedBack, setlastfeedBack] = useState("");
    const [promptResponse, setPromptResponse] = useState("")
    const options = [
        { key: 'getSummary', text: 'Get Summary'},
        { key: 'getPersonalFeedBack', text: 'Get Personal Feedback' },
    ]

    let captions;

    useEffect(() => {
        captions = call.feature(Features.Captions);
        startCaptions(captions);
        
        return () => {
            // cleanup
            captions.off('captionsReceived', captionHandler);
        };
    }, []);

    const startCaptions = async () => {
        try {
            if (!captions.isCaptionsActive || !captionsStarted) {
                await captions.startCaptions({ spokenLanguage: 'en-us' });
                setCaptionsStarted(!captionsStarted);
            }
            captions.on('captionsReceived', captionHandler);
        } catch (e) {
            console.error('startCaptions failed', e);
        }
    };

    const captionHandler = (captionData) => {
        let mri = '';
        if (captionData.speaker.identifier.kind === 'communicationUser') {
            mri = captionData.speaker.identifier.communicationUserId;
        } else if (captionData.speaker.identifier.kind === 'microsoftTeamsUser') {
            mri = captionData.speaker.identifier.microsoftTeamsUserId;
        } else if (captionData.speaker.identifier.kind === 'phoneNumber') {
            mri = captionData.speaker.identifier.phoneNumber;
        }

        const captionText = `${captionData.speaker.displayName}: ${captionData.text}`;

        console.log(mri, captionText);
        if (captionData.resultType === ResultType.Final) {
            setCaptionHistory(oldCaptions => [...oldCaptions, captionText]);
        }

    };

    
    const getSummary = () => {
        // placeholder until we get server response
        setPromptResponse("FHL <=> Get summary")
    }

    const getPersonalFeedback = () => {
        // placeholder until we get server response
        setPromptResponse("FHL <=> Get Personal FeedBack")

    }

    const onChangeHandler = (e, item) => {
        let communicationAiOption = item.key;
        switch (communicationAiOption) {
            case "getSummary":
                getSummary()
                break
            case "getPersonalFeedBack":
                getPersonalFeedback()
                break
        }

    }

    return (
        <>
        <div id="" className="">
            <Dropdown
                placeholder="Select an option"
                label="Basic uncontrolled example"
                options={options}
                styles={{dropdown: { width: 300 },}}
                onChange={onChangeHandler}
            />
        </div>
        <div id="communicationResponse" className="">           
            <h1>{promptResponse}</h1>
            <h2>{"Place holder of captions data (will be removed)"}</h2>
            <div id="captionArea" className="caption-area">
                {
                    captionHistory.map((caption, index) => (
                        <div key={index}>{caption}</div>
                    ))
                }
            </div>  
        </div>
        </>
    );
};

export default CommunicationAI;