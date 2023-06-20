import React, { useState } from 'react';
import {
    TextField,
    PrimaryButton,
    Checkbox
} from 'office-ui-fabric-react';

export const ProxyConfiguration = (props) => {
    const [proxyUrl, setProxyUrl] = useState('');

    return (
        <div>
            Proxy configuration
            <Checkbox 
                className='mt-2 ml-3'
                label='Use proxy'
                checked={props.proxy.useProxy}
                onChange={props.handleProxyChecked}
                disabled={!props.proxy.url}
            />
            <div className='mt-2 ml-3'>{props.proxy.url}</div>
            <TextField
                className='mt-2 ml-3'
                label='URL'
                onChange={(e) => {
                    setProxyUrl(e.target.value);
                }}
                value={proxyUrl}
            >
            </TextField>
            <div className='button-group ms-Grid-row mt-2 ml-3'>
                <div className='button-container ms-Grid-col ms-sm6'>
                    <PrimaryButton
                        text='Add URL'
                        disabled={!proxyUrl}
                        onClick={() => props.handleAddProxyUrl(proxyUrl)}
                    />
                </div>
                <div className='button-container ms-Grid-col ms-sm6'>
                    <PrimaryButton
                        text='Reset'
                        onClick={() => {
                            setProxyUrl('');
                            props.handleProxyUrlReset();
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
