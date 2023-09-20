import React, { useState, useEffect } from "react";
import { Features, ResultType, CallKind } from '@azure/communication-calling';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { utils, acsOpenAiPromptsApi } from "../../Utils/Utils";


const CommunicationAI = ({call}) => {
    const [showSpinner, setShowSpinner] = useState(false);
    const [lastSummary, setLastSummary] = useState("");
    const [captionsSummaryIndex, setCaptionsSummaryIndex] = useState(0);
    const [lastFeedBack, setLastFeedBack] = useState("");
    const [captionsFeedbackIndex, setCaptionsFeedbackIndex] = useState(0);
    const [promptResponse, setPromptResponse] = useState("")
    const [dropDownLabel, setDropDownLabel] = useState("")
    const options = [
        { key: 'getSummary', text: 'Get Summary' },
        { key: 'getPersonalFeedBack', text: 'Get Personal Feedback' },
        { key: 'getSentiments', text: 'Get Sentiments'}
    ];

    useEffect(() => {
        call.on('stateChanged', () => {
            if (call.state === 'Disconnected') {
                callInsight(call.id);
            }
        });
    }, []);

    const supportXBoxSupportAgent = async () => {
        const currentCaptionsData = window.captionHistory.slice(captionsSummaryIndex);
        let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.supportXBoxSupportAgent, displayName, lastSummary, currentCaptionsData);
        console.log("response received from supportXBoxSupportAgent");
        console.log(response);
        const content = response.choices[0].message.content;
        setLastSummary(content);
        setCaptionsSummaryIndex(window.captionHistory.length);
        setPromptResponse(content);
    }

    const callInsight = async (callId) => {
        const currentCaptionsData = window.captionHistory.join(" ");
        await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.callInsight, 'displayName', 'lastFeedBack', currentCaptionsData, callId);
    }

    const getSummary = async () => {
        const currentCaptionsData = window.captionHistory.slice(captionsSummaryIndex);
        let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.summary, displayName, lastSummary, currentCaptionsData);
        const content = response.choices[0].message.content;
        setLastSummary(content);
        setCaptionsSummaryIndex(window.captionHistory.length);
        setPromptResponse(content);
    }

    const getPersonalFeedback = async () => {
        const currentCaptionsData = window.captionHistory.slice(captionsFeedbackIndex);
        let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.feedback, displayName, lastFeedBack, currentCaptionsData)
        const content = response.choices[0].message.content;
        setLastFeedBack(content);
        setCaptionsFeedbackIndex(window.captionHistory.length);
        setPromptResponse(content);
    }

    const getSentiments = async () => {
        const currentCaptionsData = window.captionHistory.join(" ");
        let response = await utils.sendCaptionsDataToAcsOpenAI(acsOpenAiPromptsApi.sentiments, displayName, lastFeedBack, currentCaptionsData)
        const content = response;
        setLastFeedBack(content);
        setCaptionsFeedbackIndex(window.captionHistory.length);
        setPromptResponse(content);
    }

    const onChangeHandler = (e, item) => {
        let communicationAiOption = item.key;
        setDropDownLabel(item.text);
        setShowSpinner(true);
        switch (communicationAiOption) {
            case "getSummary":
                getSummary().finally(() => setShowSpinner(false));
                break;
            case "getPersonalFeedBack":
                getPersonalFeedback().finally(() => setShowSpinner(false));
                break;
            case "getSentiments":
                getSentiments().finally(() => setShowSpinner(false));
                break;
        }

    }

    return (
        <>
            <div id="" className="">
                <Dropdown
                    placeholder="Select an option"
                    label={dropDownLabel}
                    options={options}
                    styles={{ dropdown: { width: 300 }, }}
                    onChange={onChangeHandler}
                />
            </div>

            <div id="communicationResponse">
                {
                    showSpinner &&
                    <div>
                        <div className="loader inline-block"> </div>
                        <div className="ml-2 inline-block">Waiting for the AI response...</div>
                    </div>
                }
                <p>{showSpinner ? '' : promptResponse}</p>
            </div>
        </>
    );
};

export default CommunicationAI;