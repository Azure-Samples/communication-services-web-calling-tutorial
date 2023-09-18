import React, { useState, useEffect } from "react";
import { Features, ResultType, Captions, CallKind, CaptionsResultType  } from '@azure/communication-calling';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { utils, acsOpenAiPromptsApi } from "../../Utils/Utils";


const CommunicationAI = ({ call }) => {
    const [captionsFeature, setCaptionsFeature] = useState(call.feature(Features.Captions));
    const [captions, setCaptions] = useState(captionsFeature.captions);

    const [captionsStarted, setCaptionsStarted] = useState(false);
    const [showSpinner, setShowSpinner] = useState(false);
    const [captionHistory, setCaptionHistory] = useState([]);

    // Summary
    const [lastSummary, setLastSummary] = useState("");
    const [captionsSummaryIndex, setCaptionsSummaryIndex] = useState(0);

    // Feedback
    const [lastFeedBack, setLastFeedBack] = useState("");
    const [captionsFeedbackIndex, setCaptionsFeedbackIndex] = useState(0);

    // Sentiment
    const [lastSentiment, setLastSentiment] = useState("");
    const [captionsSentimentIndex, setCaptionsSentimentIndex] = useState(0);

    // Support Agent
    const [lastSupportAgentResponse, setLastSupportAgentResponse] = useState("");
    const [captionsSupportAgentResponseIndex, setCaptionsSupportAgentResponseIndex] = useState(0);

    const [promptMessage, setPromptMessage] = useState("");


    const [dropDownLabel, setDropDownLabel] = useState("")
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const [debounceCounterRunning, setDebounceCounterRunning] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);

    const options = [
        { key: 'getSummary', text: 'Get Summary' },
        { key: 'getPersonalFeedBack', text: 'Get Personal Feedback' },
        { key: 'getSentiments', text: 'Get Sentiment Feedback' },
        { key: 'getSuggestionForXBoxSupportAgent', text: 'Get Suggestion for Agent' },
        // { key: 'getCallInsights', text: 'Get Call Insights' },
    ]
    // let displayName = window.displayName;
    let localMri = (call.kind === CallKind.Call) ? window.identityMri.communicationUserId : window.identityMri.rawId;
    let debounceTimeoutFn;
    let role;

    useEffect(() => {
        startCaptions(captions);

        return () => {
            // cleanup
            captions.off('CaptionsActiveChanged', captionsActiveHandler);
            captions.off('CaptionsReceived', captionsReceivedHandler);
            captions.off('SpokenLanguageChanged', activeSpokenLanguageHandler);
            if (captions.captionsType === 'TeamsCaptions') {
                captions.off('CaptionLanguageChanged', activeCaptionLanguageHandler);
            }
        };
    }, []);

    useEffect(() => {
        console.log(`useEffect dropdpwnLabel == ${dropDownLabel}. isSpeaking == ${isSpeaking} === isUserSpeaking == ${isUserSpeaking}`)
        clearTimeout(debounceTimeoutFn)
        if (dropDownLabel == "") {
            setShowSpinner(false); 
            return
        }
        if ((isSpeaking && dropDownLabel != "getSuggestionForXBoxSupportAgent" && !debounceCounterRunning) || 
            (dropDownLabel == "getSuggestionForXBoxSupportAgent" && isUserSpeaking)) {
            const message = "FeedBack will be retrieved after you finish talking";
            !showSpinner && setShowSpinner(true)
            setPromptMessage(message);
            !debounceCounterRunning && setDebounceCounterRunning(true);
        } else {
            if (debounceCounterRunning) {
                debounceTimeoutFn = setTimeout(() => {
                    debounceCounterRunning && setDebounceCounterRunning(false);
                }, 5000);
            } else {
                dropDownHandler();
            }
        }
    }, [isSpeaking, dropDownLabel, debounceCounterRunning,isUserSpeaking]);

    const startCaptions = async () => {
        try {
            if (!captions.isCaptionsFeatureActive) {
                await captions.startCaptions({ spokenLanguage: 'en-us' });
                setCaptionsStarted(!captionsStarted);
            }
            captions.on('CaptionsActiveChanged', captionsActiveHandler);
            captions.on('CaptionsReceived', captionsReceivedHandler);
            captions.on('SpokenLanguageChanged', activeSpokenLanguageHandler);
            if (captions.captionsType === 'TeamsCaptions') {
                captions.on('CaptionLanguageChanged', activeCaptionLanguageHandler);
            }
        } catch (e) {
            console.error('startCaptions failed', e);
        }
    };

    const captionsActiveHandler = () => {
        console.log('CaptionsActiveChanged: ', captions.isCaptionsFeatureActive);
    }
    const activeSpokenLanguageHandler = () => {

    }
    const activeCaptionLanguageHandler = () => {

    }

    const captionsReceivedHandler  = (captionData) => {
        let mri = '';
        if (captionData.speaker.identifier.kind === 'communicationUser') {
            mri = captionData.speaker.identifier.communicationUserId;
        } else if (captionData.speaker.identifier.kind === 'microsoftTeamsUser') {
            mri = captionData.speaker.identifier.microsoftTeamsUserId;
        } else if (captionData.speaker.identifier.kind === 'phoneNumber') {
            mri = captionData.speaker.identifier.phoneNumber;
        }
        if (mri.trim() == localMri &&  !isSpeaking) {
            setIsSpeaking(true)
            role = '[agent]'
        } else if (!isUserSpeaking){
            setIsUserSpeaking(true)
            role = '[user]'
        }
        
        const captionText = `${role}${captionData.captionText ?? captionData.spokenText}`;

        if (captionData.resultType === 'Final') {
            setCaptionHistory(oldCaptions => [...oldCaptions, captionText]);
            mri == localMri ? setIsSpeaking(false) : setIsUserSpeaking(false)
        }
    };

    const dropDownHandler = async () => {
        dropDownLabel != "" && !showSpinner && setShowSpinner(true)
        setPromptMessage("Waiting for the AI response...");
        switch (dropDownLabel) {
            case "getSummary":
                await getSummary().finally(() => setShowSpinner(false));
                break;
            case "getPersonalFeedBack":
                await getPersonalFeedback().finally(() => setShowSpinner(false));
                break;
            case "getSentiments":
                await getSentiment().finally(() => setShowSpinner(false));
                break;
            case "getSuggestionForXBoxSupportAgent":
                await getSuggestionForXBoxSupportAgent().finally(() => setShowSpinner(false));
                break;
        }
    }

    const getSummary = async () => {
        try {
            const currentCaptionsData = captionHistory.slice(captionsSummaryIndex);
            let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.summary, displayName, lastSummary, currentCaptionsData);
            let content = response.choices[0].message.content;
            console.log(`getSummary summary ===> ${JSON.stringify(content)}`)
            displayResponse("Conversation Summary", content);
            setLastSummary(content);
            setCaptionsSummaryIndex(captionHistory.length);
        } catch (error) {
            console.error(JSON.stringify(error))
        }
    }

    const getPersonalFeedback = async () => {
        try {
            const currentCaptionsData = captionHistory.slice(captionsFeedbackIndex);
            let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.feedback, displayName, lastFeedBack, currentCaptionsData)
            let content = response.choices[0].message.content;
            console.log(`getPersonalFeedback ===> ${JSON.stringify(content)}`)
            displayResponse("Speaking Personal Feedback", content);
            setLastFeedBack(content);
            setCaptionsFeedbackIndex(captionHistory.length);
        } catch(error) {
            console.error(JSON.stringify(error))
        }
    }

    const getSentiment = async () => {
        try {
            const currentCaptionsData = captionHistory.slice(captionsSentimentIndex);
            let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.sentiment, displayName, lastSentiment, currentCaptionsData)
            let content = response.emotions && response.emotions.join(", ")
            let callToAction = response.call_to_action;
            if (!content || !content.length) {
                content = "Neutral" //default is no senitment is detected
            }
            if (callToAction) {
                content += "\nRecommended Action:\n"
                content += callToAction;
            } 
            console.log(`getSentimentt ===> ${JSON.stringify(content)}`)
            displayResponse("Conversation Sentiment", content);
            setLastSentiment(content);
            setCaptionsSentimentIndex(captionHistory.length);
        } catch(error) {
            console.error(JSON.stringify(error))
        }
    }

    const getSuggestionForXBoxSupportAgent = async () => {
        try {
            const currentCaptionsData = captionHistory.slice(captionsSupportAgentResponseIndex); 
            let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.supportAgent, 
                    displayName, lastSupportAgentResponse, currentCaptionsData, true)
            let content = response.suggested_reply;
            console.log(`getSuggestionForXBoxSupportAgent ===> ${JSON.stringify(content)}`)
            displayResponse("Agent Support Bot Suggestions", content);
            setLastSupportAgentResponse(content);
            setCaptionsSupportAgentResponseIndex(captionHistory.length);
        } catch(error) {
            console.error(JSON.stringify(error))
        }
    }

    const getCallInsights = async () => {
        let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.callInsights, 
                displayName, "", captionHistory, true)
        console.log(`getCallInsights ===> ${JSON.stringify(response)}`)
    }

    const onChangeHandler = (e, item) => {
        setDropDownLabel(item.key);
    }

    const displayResponse = (responseType, responseText) => {
        let captionAreasContainer = document.getElementById('captionsArea');
        let aisResponse = document.createElement('div')

        if(!responseText || !responseText.length) {return;}

        let aiResponseType = document.createElement('div');
        aiResponseType.style['padding'] = '5px';
        aiResponseType.style['whiteSpace'] = 'pre-line';
        aiResponseType.style['text-color'] = 'white';
        aiResponseType.style['font-weight'] = 'bold';
        aiResponseType.style['font-size'] = '16px';
        aiResponseType.style['color'] = 'green';
        aiResponseType.textContent = responseType;

        let aiResponseContent = document.createElement('div');
        aiResponseContent.style['borderBottom'] = '1px solid';
        aiResponseContent.style['padding'] = '10px';
        aiResponseContent.style['whiteSpace'] = 'pre-line';
        aiResponseContent.style['color'] = 'white';
        aiResponseContent.style['font-size'] = '12px';
        aiResponseContent.textContent = responseText;

        aisResponse.append(aiResponseType);
        aisResponse.append(aiResponseContent);
        captionAreasContainer.appendChild(aisResponse);
    }

    return (
        <>
            {
                (call.state === "Disconnected") && getCallInsights()
            }
            <div id="" className="">
                {
                    showSpinner &&
                    <div>
                        <div className="loader inline-block"> </div>
                        <div className="ml-2 inline-block">
                            {
                                promptMessage
                            }
                        </div>
                    </div>
                }
                <Dropdown
                    placeholder="Select an option"
                    label={dropDownLabel}
                    options={options}
                    styles={{ dropdown: { width: 300 }, }}
                    onChange={onChangeHandler}
                />
            </div>

            <div id="communicationResponse">
                <div className="scrollable-captions-container">
                    <div id="captionsArea" className="captions-area">
                    </div>
                </div>
            </div>
        </>
    );
};

export default CommunicationAI;