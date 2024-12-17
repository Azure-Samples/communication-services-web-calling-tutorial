import React, { useEffect, useState } from "react";
import { Features } from '@azure/communication-calling';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';

// CallCaption react function component
const CallCaption = ({ call }) => {
    const [captionsFeature, setCaptionsFeature] = useState(call.feature(Features.Captions));
    const [capabilitiesFeature, setCapabilitiesFeature] = useState(call.feature(Features.Capabilities));
    const [captions, setCaptions] = useState(captionsFeature.captions);
    const [currentSpokenLanguage, setCurrentSpokenLanguage] = useState(captions.activeSpokenLanguage);
    const [currentCaptionLanguage, setCurrentCaptionLanguage] = useState(null);
    let captionLanguageCurrent = null;
    

    useEffect(() => {
        try {
            startCaptions(captions);
        }
        catch(e) {
            console.log("Captions not configured for this release version")
        }
        
        return () => {
            // cleanup
            stopCaptions(captions);
            captions.off('CaptionsActiveChanged', captionsActiveHandler);
            captions.off('CaptionsReceived', captionsReceivedHandler);
            captions.off('SpokenLanguageChanged', activeSpokenLanguageHandler);
            if (captions.kind === 'TeamsCaptions' && capabilitiesFeature.capabilities.setCaptionLanguage?.isPresent) {
                captions.off('CaptionLanguageChanged', activeCaptionLanguageHandler);
            }
        };
    }, []);

    const startCaptions = async () => {
        try {
            if (!captions.isCaptionsFeatureActive) {
                await captions.startCaptions({ spokenLanguage: 'en-us' });
            }
            captions.on('CaptionsActiveChanged', captionsActiveHandler);
            captions.on('CaptionsReceived', captionsReceivedHandler);
            captions.on('SpokenLanguageChanged', activeSpokenLanguageHandler);
            capabilitiesFeature.on('CapabilitiesChanged', (value) => {
                if (value.newValue.setCaptionLanguage) {
                    setCapabilitiesFeature(call.feature(Features.Capabilities));
                }
            });
            if (captions.kind === 'TeamsCaptions' && capabilitiesFeature.capabilities.setCaptionLanguage?.isPresent) {
                captions.on('CaptionLanguageChanged', activeCaptionLanguageHandler);
            }
        } catch (e) {
            console.error('startCaptions failed', e);
        }
    };

    const stopCaptions = async () => {
        try {
            await captions.stopCaptions();
        } catch (e) {
            console.error('stopCaptions failed', e);
        }
    };

    const captionsActiveHandler = () => {
        console.log('CaptionsActiveChanged: ', captions.isCaptionsFeatureActive);
        setCurrentSpokenLanguage(captions.activeSpokenLanguage);
        setCurrentCaptionLanguage(captions.activeCaptionLanguage);
    }
    const activeSpokenLanguageHandler = () => {
        setCurrentSpokenLanguage(captions.activeSpokenLanguage);
    }
    const activeCaptionLanguageHandler = () => {
        setCurrentCaptionLanguage(captions.activeCaptionLanguage);
        captionLanguageCurrent = captions.activeCaptionLanguage;
    }

    const captionsReceivedHandler = (captionData) => {
        if (!captionLanguageCurrent || captionLanguageCurrent === captionData.captionLanguage) {
            let mri = '';
            switch (captionData.speaker.identifier.kind) {
                case 'communicationUser': { mri = captionData.speaker.identifier.communicationUserId; break; }
                case 'microsoftTeamsUser': { mri = captionData.speaker.identifier.microsoftTeamsUserId; break; }
                case 'phoneNumber': { mri = captionData.speaker.identifier.phoneNumber; break; }
            }
            let captionAreasContainer = document.getElementById('captionsArea');
            const newClassName = `prefix${mri.replace(/:/g, '').replace(/-/g, '').replace(/\+/g, '')}`;
            const captionText = `${captionData.timestamp.toUTCString()}
                ${captionData.speaker.displayName ?? mri}: ${captionData.captionText ?? captionData.spokenText}`;

            let foundCaptionContainer = captionAreasContainer.querySelector(`.${newClassName}[isNotFinal='true']`);

            if (!foundCaptionContainer) {
                let captionContainer = document.createElement('div');
                captionContainer.setAttribute('isNotFinal', 'true');
                captionContainer.style['borderBottom'] = '1px solid';
                captionContainer.style['whiteSpace'] = 'pre-line';
                captionContainer.textContent = captionText;
                captionContainer.classList.add(newClassName);
                captionContainer.classList.add('caption-item')

                captionAreasContainer.appendChild(captionContainer);

            } else {
                foundCaptionContainer.textContent = captionText;

                if (captionData.resultType === 'Final') {
                    foundCaptionContainer.setAttribute('isNotFinal', 'false');
                }
            }
        }
    };

    const spokenLanguageSelectionChanged = async (event, item) => {
        const spokenLanguages = captions.supportedSpokenLanguages;
        const language = spokenLanguages.find(language => { return language === item.key });
        await captions.setSpokenLanguage(language);
        setCurrentSpokenLanguage(language); 
    };

    const SpokenLanguageDropdown = () => { 
        const keyedSupportedSpokenLanguages = captions.supportedSpokenLanguages.map(language => ({key: language, text: language}));
        return <Dropdown
                selectedKey={currentSpokenLanguage}
                onChange={spokenLanguageSelectionChanged}
                label={'Spoken Language'}
                options={keyedSupportedSpokenLanguages}
                styles={{ label: {color: '#edebe9'}, dropdown: { width: 100 }, root: {paddingBottom: '1rem'} }}
            />
    }

    const captionLanguageSelectionChanged = async (event, item) => {
        const captionLanguages = captions.supportedCaptionLanguages;
        const language = captionLanguages.find(language => { return language === item.key });
        await captions.setCaptionLanguage(language);
        setCurrentCaptionLanguage(language); 
    };

    const CaptionLanguageDropdown = () => {
        const keyedSupportedCaptionLanguages = captions.supportedCaptionLanguages.map(language => ({key: language, text: language}));
        return <Dropdown
                selectedKey={currentCaptionLanguage}
                onChange={captionLanguageSelectionChanged}
                label={'Caption Language'}
                options={keyedSupportedCaptionLanguages}
                styles={{ label: {color: '#edebe9'}, dropdown: { width: 100, overflow: 'scroll' }, root: {paddingBottom: '1rem'}  }}
            />
    }

    return (
        <>
            {captions && <SpokenLanguageDropdown/>}
            {captions && captions.kind === 'TeamsCaptions'  && capabilitiesFeature.capabilities.setCaptionLanguage?.isPresent && <CaptionLanguageDropdown/>}
            <div className="scrollable-captions-container">
                <div id="captionsArea" className="captions-area">
                </div>
            </div>
        </>
    );
};

export default CallCaption;
