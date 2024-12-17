import React, { useEffect, useState } from "react";
import { Features } from '@azure/communication-calling';
import { PrimaryButton } from 'office-ui-fabric-react/lib/components/Button';

// RealTimeText react function component
const RealTimeTextCard = ({ call, state }) => {
    const [realTimeTextFeature, setRealTimeTextFeature] = useState(call.feature(Features.RealTimeText));
    const [rttInputLiveHandler, setRttInputLiveHandler] = useState(false);

    useEffect(() => {
        try {
            subscribeToSendRealTimeTextLive();
        }
        catch(error) {
            console.log("RealTimeText not configured for this release version")
        }
        
        return () => {
            // cleanup
            let rttTextField = document.getElementById('rttTextField');
            rttTextField.removeEventListener('input', subscribeToSendRealTimeTextHelper);
        };
    }, []);

    const sendRTT = async () => {
        try {
            let rttTextField = document.getElementById('rttTextField');
            if (!state.firstRealTimeTextReceivedorSent) {
                state.setFirstRealTimeTextReceivedorSent(true);
            }
            realTimeTextFeature.sendRealTimeText(rttTextField.value, true);
            rttTextField.value = null;
        } catch (error) {
            console.log('ERROR Send RTT failed', error);
        }
    }

    const sendRealTimeTextLiveHandler = () => {
        if (!rttInputLiveHandler) {
            try {
                let rttTextField = document.getElementById('rttTextField');
                rttTextField.removeEventListener('input', subscribeToSendRealTimeTextHelper);
                rttTextField.addEventListener('input', (event) => {
                    if (!state.firstRealTimeTextReceivedorSent) {
                        state.setFirstRealTimeTextReceivedorSent(true);
                    }
                    realTimeTextFeature.sendRealTimeText(rttTextField.value);
                })
                setRttInputLiveHandler(true);
            } catch (error) {
                console.log('ERROR Send live rtt handler subscription failed', error);
            }
        }
    }

    const subscribeToSendRealTimeTextHelper = () => {
        let rttTextField = document.getElementById('rttTextField');
        if (rttTextField.value !== '') {
            sendRealTimeTextLiveHandler();
        }
        setRttInputLiveHandler(true);
    }

    const subscribeToSendRealTimeTextLive = () => {
        if (!rttInputLiveHandler) {
            try {
                let rttTextField = document.getElementById('rttTextField');
                rttTextField.removeEventListener('input', subscribeToSendRealTimeTextHelper);
                rttTextField.addEventListener('input', subscribeToSendRealTimeTextHelper);
            } catch (error) {
                console.log('ERROR setting live rtt handler', error);
            }

        }
    }
    
    return (
        <>
            <div>
                <form style={{padding: '1rem 0'}}>
                    <label style={{display:'block'}}>RealTimeText Message</label>
                    <input
                        id='rttTextField'
                        style={{padding: '0.4rem', width: '15rem'}}
                    />
                    <PrimaryButton text="Send" onClick={sendRTT}/>
                </form>
            </div>
            <div className="scrollable-rtt-container">
                <div id="rttArea" className="rtt-area">
                </div>
            </div>
        </>
    );
};

export default RealTimeTextCard;
