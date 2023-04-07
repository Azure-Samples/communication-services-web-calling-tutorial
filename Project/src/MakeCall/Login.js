import React, { useState } from "react";
import {
    TextField, PrimaryButton, Checkbox,
    MessageBar, MessageBarType
} from 'office-ui-fabric-react'
import { utils } from "../Utils/Utils";
import { v4 as uuid } from 'uuid';
import OneSignal from "react-onesignal";
import * as config from '../../clientConfig.json';

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.userDetailsResponse = undefined;
        this.displayName = undefined;
        this.clientTag = uuid();
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        this._callAgentInitPromise = undefined;
        this._callAgentInitPromiseResolve = undefined;
        this.currentCustomTurnConfig = undefined;
        this.state = {
            initializedOneSignal: false,
            subscribedForPushNotifications: false,
            initializeCallAgentAfterPushRegistration: true,
            showUserProvisioningAndSdkInitializationCode: false,
            showSpinner: false,
            loginWarningMessage: undefined,
            loginErrorMessage: undefined,
            proxy: {
                useProxy: false,
                url: ''
            },
            customTurn: {
                useCustomTurn: false,
                isLoading: false,
                turn: null
            }
        }
    }

    async componentDidMount() {
        try {
            if (config.oneSignalAppId) {
                if (location.protocol !== 'https:') {
                    throw new Error('Web push notifications can only be tested on trusted HTTPS.');
                }

                await OneSignal.init({
                    appId: config.oneSignalAppId,
                    safari_web_id: config.oneSignalSafariWebId,
                    notifyButton: {
                        enable: true,
                        colors: {
                            'circle.background': '#ca5010'
                        }
                    },
                });

                OneSignal.addListenerForNotificationOpened(async function (event) {
                    console.log('Push notification clicked and app will open if it is currently closed');
                    await this.handlePushNotification(event);
                }.bind(this));

                OneSignal.on('notificationDisplay', async function (event) {
                    console.log('Push notification displayed');
                    await this.handlePushNotification(event);
                }.bind(this));

                OneSignal.on('subscriptionChange', async function(isSubscribed) {
                    console.log("Push notification subscription state is now: ", isSubscribed);
                    this.setState({ subscribedForPushNotifications:
                        (await OneSignal.isPushNotificationsEnabled()) && (await OneSignal.getSubscription())
                    });
                }.bind(this));

                this.setState({ initializedOneSignal: true});
                this.setState({ subscribedForPushNotifications:
                    (await OneSignal.isPushNotificationsEnabled()) && (await OneSignal.getSubscription())
                });

                await OneSignal.registerForPushNotifications();
            }
        } catch (error) {
            this.setState({
                loginWarningMessage: error.message
            });
            console.warn(error);
        }
    }

    async logIn() {
        try {
            this.setState({ showSpinner: true });
            if (!this.state.token && !this.state.communicationUserId) {
                this.userDetailsResponse = await utils.getCommunicationUserToken();
            } else if (this.state.token && this.state.communicationUserId) {
                this.userDetailsResponse = await utils.getOneSignalRegistrationTokenForCommunicationUserToken(
                    this.state.token, this.state.communicationUserId
                );
            } else if (this.state.token && !this.state.communicationUserId) {
                throw new Error('You must specify the associated ACS identity for the provided ACS communication user token');
            } else if (!this.state.token && this.state.communicationUserId) {
                throw new Error('You must specify the ACS communication user token for the provided ACS identity');
            }
            this.setState({
                token: this.userDetailsResponse.communicationUserToken.token
            });
            this.setState({
                communicationUserId: utils.getIdentifierText(this.userDetailsResponse.communicationUserToken.user)
            });
            if (this.state.initializedOneSignal) {
                OneSignal.setExternalUserId(this.userDetailsResponse.oneSignalRegistrationToken);
            }
            if (!this.state.subscribedForPushNotifications ||
                (this.state.subscribedForPushNotifications && this.state.initializeCallAgentAfterPushRegistration)) {
                await this.props.onLoggedIn({ 
                    communicationUserId: this.userDetailsResponse.communicationUserToken.user.communicationUserId,
                    token: this.userDetailsResponse.communicationUserToken.token,
                    displayName: this.displayName,
                    clientTag:this.clientTag,
                    proxy: this.state.proxy,
                    customTurn: this.state.customTurn
                });
            }
            console.log('Login response: ', this.userDetailsResponse);
            this.setState({ loggedIn: true });
        } catch (error) {
            this.setState({
                loginErrorMessage: error.message
            });
            console.log(error);
        } finally {
            this.setState({ showSpinner: false });
        }
    }

    async handlePushNotification(event) {
        try {
            if (!this.callAgent && !!event.data.incomingCallContext) {
                if (!this.state.token) {
                    const oneSignalRegistrationToken = await OneSignal.getExternalUserId();
                    this.userDetailsResponse = await utils.getCommunicationUserTokenForOneSignalRegistrationToken(oneSignalRegistrationToken);
                    this.setState({
                        token: this.userDetailsResponse.communicationUserToken.token
                    });
                    this.setState({
                        communicationUserId: utils.getIdentifierText(this.userDetailsResponse.communicationUserToken.user)
                    });
                }
                this.props.onLoggedIn({ 
                    communicationUserId: this.userDetailsResponse.communicationUserToken.user.communicationUserId,
                    token: this.userDetailsResponse.communicationUserToken.token,
                    displayName: this.displayName,
                    clientTag:this.clientTag,
                    proxy: this.state.proxy,
                    customTurn: this.state.customTurn
                });
                this._callAgentInitPromise = new Promise((resolve) => { this._callAgentInitPromiseResolve = resolve });
                await this._callAgentInitPromise;
                console.log('Login response: ', this.userDetailsResponse);
                this.setState({ loggedIn: true })
                if (!this.callAgent.handlePushNotification) {
                    throw new Error('Handle push notification feature is not implemented in ACS Web Calling SDK yet.');
                }
                await this.callAgent.handlePushNotification(event.data);
            }
        } catch (error) {
            this.setState({
                loginErrorMessage: error.message
            });
            console.log(error);
        }
    }

    setCallAgent(callAgent) {
        this.callAgent = callAgent;
        if (!!this._callAgentInitPromiseResolve) {
            this._callAgentInitPromiseResolve();
        }
    }

    handleProxyChecked = (e, isChecked) => {
        this.setState({
            ...this.state,
            proxy: {
                ...this.state.proxy,
                useProxy: isChecked
            }
        });
    };

    handleAddProxyUrl = (input) => {
        if (input) {
            this.setState({
                ...this.state,
                proxy: {
                    ...this.state.proxy,
                    url: input
                }
            });
        }
    };

    handleProxyUrlReset = () => {
        this.setState({
            ...this.state,
            proxy: {
                ...this.state.proxy,
                url: ''
            }
        });
    };

    handleAddTurnConfig = (iceServer) => {
        const turnConfig = this.state.customTurn.turn ?? {
            iceServers: []
        };
        turnConfig.iceServers.push(iceServer);

        this.setState({
            ...this.state,
            customTurn: {
                ...this.state.customTurn,
                turn: turnConfig
            }
        });
    }

    handleCustomTurnChecked = (e, isChecked) => {
        if (isChecked) {
            this.setState({
                ...this.state,
                customTurn: {
                    ...this.state.customTurn,
                    useCustomTurn: true,
                    isLoading: true
                }
            });
    
            this.getOrCreateCustomTurnConfiguration().then(res => {
                this.setState({
                    ...this.state,
                    customTurn: {
                        ...this.state.customTurn,
                        useCustomTurn: !!res ?? false,
                        isLoading: false,
                        turn: res
                    }
                });
            }).catch(error => {
                console.error(`Not able to fetch custom TURN: ${error}`);
                this.setState({
                    ...this.state,
                    customTurn: {
                        ...this.state.customTurn,
                        useCustomTurn: false,
                        isLoading: false,
                        turn: null
                    }
                });
            });
        } else {
            this.setState({
                ...this.state,
                customTurn: {
                    ...this.state.customTurn,
                    useCustomTurn: false,
                    isLoading: false,
                    turn: null
                }
            });
        }
    }

    getOrCreateCustomTurnConfiguration = async () => {
        if (!this.currentCustomTurnConfig || Date.now() > new Date(this.currentCustomTurnConfig.expiresOn).getTime()) {
            // Credentials expired. Try to get new ones.
            const response = await fetch(`${window.location.protocol}//${window.location.host}/customRelayConfig`);
            const relayConfig = (await response.json()).relayConfig;
            this.currentCustomTurnConfig = relayConfig;
        }

        const iceServers = this.currentCustomTurnConfig.iceServers.map(iceServer => {
            return {
                urls: [...iceServer.urls],
                username: iceServer.username,
                credential: iceServer.credential
            };
        });

        return { iceServers };
    }

    handleTurnUrlResetToDefault = () => {
        this.setState({
            ...this.state,
            customTurn: {
                ...this.state.customTurn,
                isLoading: true
            }
        });

        this.getOrCreateCustomTurnConfiguration().then(res => {
            this.setState({
                ...this.state,
                customTurn: {
                    ...this.state.customTurn,
                    isLoading: false,
                    turn: res
                }
            });
        }).catch(error => {
            console.error(`Not able to fetch custom TURN: ${error}`);
            this.setState({
                ...this.state,
                customTurn: {
                    ...this.state.customTurn,
                    useCustomTurn: false,
                    isLoading: false,
                    turn: null
                }
            });
        });
    }

    handleTurnUrlReset = () => {
        this.setState({
            ...this.state,
            customTurn: {
                ...this.state.customTurn,
                turn: null
            }
        });
    }

    render() {
        const userProvisioningAndSdkInitializationCode = `
/**************************************************************************************
 *   User token provisioning service should be set up in a trusted backend service.   *
 *   Client applications will make requests to this service for gettings tokens.      *
 **************************************************************************************/
import  { CommunicationIdentityClient } from @azure/communication-administration;
const communicationIdentityClient = new CommunicationIdentityClient(<RESOURCE CONNECTION STRING>);
app.get('/getAcsUserAccessToken', async (request, response) => {
    try {
        const communicationUserId = await communicationIdentityClient.createUser();
        const tokenResponse = await communicationIdentityClient.issueToken({ communicationUserId }, ['voip']);
        response.json(tokenResponse);
    } catch(error) {
        console.log(error);
    }
});

/********************************************************************************************************
 *   Client application initializing the ACS Calling Client Web SDK after receiving token from service   *
 *********************************************************************************************************/
import { CallClient, Features } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { AzureLogger, setLogLevel } from '@azure/logger';

export class MyCallingApp {
    constructor() {
        this.callClient = undefined;
        this.callAgent = undefined;
        this.deviceManager = undefined;
        this.currentCall = undefined;
    }

    public async initCallClient() {
        const response = (await fetch('/getAcsUserAccessToken')).json();
        const token = response.token;
        const tokenCredential = new AzureCommunicationTokenCredential(token);

        // Set log level for the logger
        setLogLevel('verbose');
        // Redirect logger output to wherever desired
        AzureLogger.log = (...args) => { console.log(...args); };
        // CallClient is the entrypoint for the SDK. Use it to
        // to instantiate a CallClient and to access the DeviceManager
        this.callClient = new CallClient();
        this.callAgent = await this.callClient.createCallAgent(tokenCredential, { displayName: 'Optional ACS user name'});
        this.deviceManager = await this.callClient.getDeviceManager();

        // Handle Calls and RemoteParticipants
        // Subscribe to 'callsUpdated' event to be when a a call is added or removed
        this.callAgent.on('callsUpdated', calls => {
            calls.added.foreach(addedCall => {
                // Get the state of the call
                addedCall.state;

                //Subscribe to call state changed event
                addedCall.on('stateChanged', callStateChangedHandler);

                // Get the unique Id for this Call
                addedCall.id;

                // Subscribe to call id changed event
                addedCall.on('idChanged', callIdChangedHandler);

                // Wether microphone is muted or not
                addedCall.isMuted;

                // Subscribe to isMuted changed event
                addedCall.on('isMutedChanged', isMutedChangedHandler);

                // Subscribe to current remote participants in the call
                addedCall.remoteParticipants.forEach(participant => {
                    subscribeToRemoteParticipant(participant)
                });

                // Subscribe to new added remote participants in the call
                addedCall.on('remoteParticipantsUpdated', participants => {
                    participants.added.forEach(addedParticipant => {
                        subscribeToRemoteParticipant(addedParticipant)
                    });

                    participants.removed.forEach(removedParticipant => {
                        unsubscribeFromRemoteParticipant(removedParticipant);
                    });
                });
            });

            calls.removed.foreach(removedCall => {
                removedCallHandler(removedCall);
            });
        });
    }

    private subscribeToRemoteParticipant(remoteParticipant) {
        // Get state of this remote participant
        remoteParticipant.state;

        // Subscribe to participant state changed event.
        remoteParticipant.on('stateChanged', participantStateChangedHandler);

        // Whether this remote participant is muted or not
        remoteParticipant.isMuted;

        // Subscribe to is muted changed event.
        remoteParticipant.on('isMutedChanged', isMutedChangedHandler);

        // Get participant's display name, if it was set
        remoteParticipant.displayName;

        // Subscribe to display name changed event
        remoteParticipant.on('displayNameChanged', dispalyNameChangedHandler);

        // Weather the participant is speaking or not
        remoteParticipant.isSpeaking;

        // Subscribe to participant is speaking changed event
        remoteParticipant.on('isSpeakingChanged', isSpeakingChangedHandler);

        // Handle remote participant's current video streams
        remoteParticipant.videoStreams.forEach(videoStream => { subscribeToRemoteVideoStream(videoStream) });

        // Handle remote participants new added video streams and screen-sharing streams
        remoteParticipant.on('videoStreamsUpdated', videoStreams => {
            videoStream.added.forEach(addedStream => {
                subscribeToRemoteVideoStream(addedStream);
            });
            videoStream.removed.forEach(removedStream => {
                unsubscribeFromRemoteVideoStream(removedStream);
            });
        });
    }
}
        `;

        return (
            <div className="card">
                <div className="ms-Grid">
                    <div className="ms-Grid-row">
                        <h2 className="ms-Grid-col ms-lg6 ms-sm6 mb-4">ACS User identity Provisioning and Calling SDK Initialization</h2>
                        <div className="ms-Grid-col ms-lg6 ms-sm6 text-right">
                            <PrimaryButton className="primary-button"
                                iconProps={{iconName: 'ReleaseGate', style: {verticalAlign: 'middle', fontSize: 'large'}}}
                                text={`${this.state.showUserProvisioningAndSdkInitializationCode ? 'Hide' : 'Show'} code`}
                                onClick={() => this.setState({showUserProvisioningAndSdkInitializationCode: !this.state.showUserProvisioningAndSdkInitializationCode})}>
                            </PrimaryButton>
                        </div>
                    </div>
                    <div className="ms-Grid-row">
                    {
                        this.state.loginWarningMessage &&
                        <MessageBar
                            className="mb-2"
                            messageBarType={MessageBarType.warning}
                            isMultiline={true}
                            onDismiss={() => { this.setState({ loginWarningMessage: undefined })}}
                            dismissButtonAriaLabel="Close">
                            <b>{this.state.loginWarningMessage}</b>
                        </MessageBar>
                    }
                    </div>
                    <div className="ms-Grid-row">
                    {
                        this.state.loginErrorMessage &&
                        <MessageBar
                            className="mb-2"
                            messageBarType={MessageBarType.error}
                            isMultiline={true}
                            onDismiss={() => { this.setState({ loginErrorMessage: undefined })}}
                            dismissButtonAriaLabel="Close">
                            <b>{this.state.loginErrorMessage}</b>
                        </MessageBar>
                    }
                    </div>
                    {
                        this.state.showUserProvisioningAndSdkInitializationCode &&
                        <pre>
                            <code style={{color: '#b3b0ad'}}>
                                {userProvisioningAndSdkInitializationCode}
                            </code>
                        </pre>
                    }
                    <div>The ACS Identity SDK can be used to create a user access token which authenticates the calling clients. </div>
                    <div>The example code shows how to use the ACS Identity SDK from a backend service. A walkthrough of integrating the ACS Identity SDK can be found on <a className="sdk-docs-link" target="_blank" href="https://docs.microsoft.com/en-us/azure/communication-services/quickstarts/access-tokens?pivots=programming-language-javascript">Microsoft Docs</a></div>
                    {
                        this.state.showSpinner &&
                        <div className="justify-content-left mt-4">
                            <div className="loader inline-block"> </div>
                            <div className="ml-2 inline-block">Fetching token from service and initializing SDK...</div>
                        </div>
                    }
                    {
                        this.state.loggedIn &&
                        <div>
                            <br></br>
                            <div>Congrats! You've provisioned an ACS user identity and initialized the ACS Calling Client Web SDK. You are ready to start making calls!</div>
                            <div>The Identity you've provisioned is: <span className="identity"><b>{this.state.communicationUserId}</b></span></div>
                            <div>Usage is tagged with: <span className="identity"><b>{this.clientTag}</b></span></div>
                        </div>
                    }
                    {
                        (!this.state.showSpinner && !this.state.loggedIn) &&
                        <div>
                            <div className="ms-Grid-row">
                                    <div className="ms-Grid-col ms-sm12 ms-lg6 ms-xl6 ms-xxl6">
                                    <TextField className="mt-3"
                                                    defaultValue={undefined}
                                                    label="Optional - Display name"
                                                    onChange={(e) => { this.displayName = e.target.value }} />
                                    <TextField className="mt-3"
                                                defaultValue={this.clientTag}
                                                label="Optinal - Usage tag for this session"
                                                onChange={(e) => { this.clientTag = e.target.value }} />
                                </div>
                                <div className="ms-Grid-col ms-sm12 ms-lg6 ms-xl6 ms-xxl6">
                                     <TextField className="mt-3"
                                                placeholder="JWT Token"
                                                label="Optional - ACS communication user token. If no token is provided, then a random one will be generated"
                                                onChange={(e) => { this.state.token = e.target.value }} />
                                    <TextField className="mt-3"
                                                placeholder="8:acs:<ACS Resource ID>_<guid>"
                                                label="Optional - ACS Identity associated with the token above"
                                                onChange={(e) => { this.state.communicationUserId = e.target.value }} />
                                </div>
                            </div>
                            <div className="ms-Grid-row">
                                <div className="pre-init-option push-notification-options ms-Grid-col ms-lg4 ms-sm12"
                                    disabled={
                                        !this.state.initializedOneSignal ||
                                        !this.state.subscribedForPushNotifications ||
                                        this.isSafari
                                    }>
                                    Push Notifications options
                                    <Checkbox className="mt-2 ml-3"
                                                label="Initialize Call Agent"
                                                disabled={
                                                    !this.state.initializedOneSignal ||
                                                    !this.state.subscribedForPushNotifications ||
                                                    this.isSafari
                                                }
                                                checked={this.state.initializeCallAgentAfterPushRegistration}
                                                onChange={(e, isChecked) => { this.setState({ initializeCallAgentAfterPushRegistration: isChecked })}}/>
                                </div>
                                <TurnConfiguration
                                    customTurn={this.state.customTurn}
                                    handleCustomTurnChecked={this.handleCustomTurnChecked}
                                    handleAddTurnConfig={this.handleAddTurnConfig}
                                    handleTurnUrlResetToDefault={this.handleTurnUrlResetToDefault}
                                    handleTurnUrlReset={this.handleTurnUrlReset}
                                />
                                <ProxyConfiguration 
                                    proxy={this.state.proxy}
                                    handleProxyChecked={this.handleProxyChecked}
                                    handleAddProxyUrl={this.handleAddProxyUrl}
                                    handleProxyUrlReset={this.handleProxyUrlReset}
                                />
                            </div>
                            <div className="mt-3">
                                <PrimaryButton className="primary-button mt-3"
                                    iconProps={{iconName: 'ReleaseGate', style: {verticalAlign: 'middle', fontSize: 'large'}}}
                                    label="Provision an user" 
                                    onClick={() => this.logIn()}>
                                        Provision user and initialize SDK
                                </PrimaryButton>
                            </div>
                        </div>
                    }
                </div>
            </div>
        );
    }
}

const ProxyConfiguration = (props) => {
    const [proxyUrl, setProxyUrl] = useState('');

    return (
        <div className='pre-init-option proxy-configuration ms-Grid-col ms-lg4 ms-sm12'>
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
}

const TurnConfiguration = (props) => {
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
}
