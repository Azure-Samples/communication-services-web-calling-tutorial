import React, { useState } from 'react';
import {
    TextField,
    PrimaryButton,
    Checkbox
} from 'office-ui-fabric-react';

export const TurnConfiguration = (props) => {
    const [turnUrls, setTurnUrls] = useState('');
    const [turnUsername, setTurnUsername] = useState('');
    const [turnCredential, setTurnCredential] = useState('');

    const handleAddTurn = () => {
        if (turnUrls) {
            const iceServer = {
                urls: !!turnUrls ? turnUrls.split(';') : [],
                username: turnUsername,
                credential: turnCredential
            };
    
            props.handleAddTurnConfig(iceServer);
        }
    };

    return (
        <div className='pre-init-option proxy-configuration ms-Grid-col ms-lg4 ms-sm12'>
            Turn configuration
            <Checkbox 
                className='mt-2 ml-3'
                disabled={props.customTurn.isLoading}
                label='Use custom TURN'
                checked={props.customTurn.useCustomTurn}
                onChange={props.handleCustomTurnChecked}
            />
            <div className='mt-2 ml-3'>
                {props.customTurn.turn &&
                    props.customTurn.turn?.iceServers?.map((iceServer, key) => {
                        if (iceServer.urls && iceServer.urls.length > 0) {
                            return (
                                <div key={`iceServer-${key}`}>
                                    {iceServer?.urls?.map((url, key) => {
                                        return (
                                            <div key={`url-${key}`}>
                                                <span>{url}</span><br/>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        }

                        return (
                            <div key={`iceServer-${key}`}></div>
                        )
                    })
                }
            </div>
            <TextField
                className='mt-2 ml-3'
                label='URLs (seperate each by semicolon)'
                value={turnUrls}
                onChange={(e) => {
                    setTurnUrls(e.target.value);
                }}
            >
            </TextField>
            <TextField
                className='mt-2 ml-3'
                label='Username'
                value={turnUsername}
                onChange={(e) => {
                    setTurnUsername(e.target.value);
                }}
            >
            </TextField>
            <TextField
                className='mt-2 ml-3'
                label='Credential'
                value={turnCredential}
                onChange={(e) => {
                    setTurnCredential(e.target.value);
                }}
            >
            </TextField>
            <div className='button-group ms-Grid-row mt-2 ml-3'>
                <div className='button-container ms-Grid-col ms-sm6 ms-xl6 ms-xxl4'>
                    <PrimaryButton
                        text='Add TURN(s)'
                        onClick={handleAddTurn}
                        disabled={!props.customTurn.useCustomTurn}
                    />
                </div>
                <div className='button-container ms-Grid-col ms-sm6 ms-xl6 ms-xxl4'>
                    <PrimaryButton
                        text='Clear'
                        onClick={props.handleTurnUrlReset}
                        disabled={!props.customTurn.useCustomTurn}
                    />
                </div>
            </div>
        </div>
    )
};
