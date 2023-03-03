import React from "react";
import {
    TextField, PrimaryButton, Checkbox,
    MessageBar, MessageBarType
} from 'office-ui-fabric-react'
import { utils } from "../Utils/Utils";
import { v4 as uuid } from 'uuid';
import OneSignal from "react-onesignal";
import * as config from '../../config.json';

export default class Login extends React.Component {
    constructor(props) {
        super(props);
        this.userDetailsResponse = undefined;
        this.displayName = undefined;
        this.clientTag = uuid();
        this.state = {
            initializedOneSignal: false,
            initializeCallAgentAfterPushRegistration: true,
            showUserProvisioningAndSdkInitializationCode: false,
            showSpinner: false,
            disableInitializeButton: false,
            acsUserAccessToken: undefined,
            loginWarningMessage: undefined
        }
    }

    async componentDidMount() {
        try {
            if (config.oneSignalAppId &&
                config.functionAppOneSignalTokenRegistrationUrl &&
                config.functionAppOneSignalTokenRegistrationApiKey) {

                if (location.protocol !== 'https:') {
                    this.setState({
                        loginWarningMessage: 'You can only test web push notifications on HTTPS. ' +
                        'Remove keys \'oneSignalAppId\', \'functionAppOneSignalTokenRegistrationUrl\', and \'functionAppOneSignalTokenRegistrationApiKey\' ' +
                        'from the ./config.json file'
                    });
                    return;
                }

                if (location.hostname === "localhost" ||
                    location.hostname === "127.0.0.1") {
                    this.setState({
                        loginWarningMessage: 'You cannot test web push notifications on localhost. ' +
                        'Remove keys \'oneSignalAppId\', \'functionAppOneSignalTokenRegistrationUrl\', and \'functionAppOneSignalTokenRegistrationApiKey\' ' +
                        'from the ./config.json file'
                    });
                    return;
                }


                await OneSignal.init({
                    appId: config.oneSignalAppId,
                    notifyButton: {
                        enable: true,
                    },
                });

                // HTTPS only
                OneSignal.addListenerForNotificationOpened(async function (event) {
                    console.log('Push notification clicked and app will open if it is currently closed');
                    await this.handlePushNotification(event);
                }.bind(this));

                // HTTPS only
                OneSignal.on('notificationDisplay', async function (event) {
                    console.log('Push notification displayed');
                    await this.handlePushNotification(event);
                }.bind(this));

                // HTTPS only
                OneSignal.on('subscriptionChange', async function(isSubscribed) {
                    console.log("Push notification subscription state is now: ", isSubscribed);
                }.bind(this));

                this.setState({ initializedOneSignal: true});
            }
        } catch (e) {
            console.warn(e);
        }
    }

    async getAcsUserAccessToken() {
        try {
            const registerForWebPushNotifications = this.state.initializedOneSignal &&
                !!(await OneSignal.isPushNotificationsEnabled()) && !!(await OneSignal.getSubscription());
            this.setState({ showSpinner: true, disableInitializeButton: true });
            this.userDetailsResponse = await utils.getAcsUserAccessToken(registerForWebPushNotifications);
            this.setState({ acsUserAccessToken: this.userDetailsResponse.acsUserAccessToken });
            if (registerForWebPushNotifications) {
                OneSignal.setExternalUserId(this.userDetailsResponse.oneSignalRegistrationToken);
            }
            this.setState({ id: utils.getIdentifierText(this.userDetailsResponse.user) });
            if (!registerForWebPushNotifications ||
                (registerForWebPushNotifications && this.state.initializeCallAgentAfterPushRegistration)) {
                await this.props.onLoggedIn({
                    id: this.state.id,
                    acsUserAccessToken: this.userDetailsResponse.acsUserAccessToken,
                    displayName: this.displayName,
                    clientTag: this.clientTag
                });
            }
        } catch (error) {
            console.log(error);
        } finally {
            this.setState({ disableInitializeButton: false, showSpinner: false });
        }
    }

    async handlePushNotification(event) {
        if (!this.callAgent && !!event.data.incomingCallContext) {
            if (!this.state.acsUserAccessToken) {
                const oneSignalRegistrationToken = await OneSignal.getExternalUserId();
                this.userDetailsResponse = await utils.getAcsUserAccessTokenForOneSignalRegistrationToken(oneSignalRegistrationToken);
            }
            await this.props.onLoggedIn({
                id: this.state.id,
                acsUserAccessToken: this.userDetailsResponse.acsUserAccessToken,
                displayName: this.displayName,
                clientTag: this.clientTag
            });
            if (!this.callAgent.handlePushNotification) {
                throw new Error('Handle push notification feature is not implemented in ACS Web Calling SDK yet.');
            }
            await this.callAgent.handlePushNotification(event.data);
        }
    }

    setCallAgent(callAgent) {
        this.callAgent = callAgent;
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
                            onDismiss={() => { this.setState({ loginWarningMessage: undefined }) }}
                            dismissButtonAriaLabel="Close">
                            <b>{this.state.loginWarningMessage}</b>
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
                        this.state.acsUserAccessToken && 
                        <div>
                            <br></br>
                            <div>Congrats! You've provisioned an ACS user identity and initialized the ACS Calling Client Web SDK. You are ready to start making calls!</div>
                            <div>The Identity you've provisioned is: <span className="identity"><b>{this.state.id}</b></span></div>
                            <div>Usage is tagged with: <span className="identity"><b>{this.clientTag}</b></span></div>
                        </div>
                    }
                    {
                        this.state.showSpinner &&
                        <div className="custom-row justify-content-left align-items-center mt-4">
                            <div className="loader"> </div>
                            <div className="ml-2">Fetching token from service and initializing SDK...</div>
                        </div>
                    }
                    {
                        !this.state.acsUserAccessToken &&
                        <div>
                            <div className="ms-Grid-row">
                                <div className="ms-Grid-col ms-sm12 ms-lg6 ms-xl6 ms-xxl6">
                                    <TextField className="mt-3"
                                                defaultValue={undefined}
                                                label="Optional display name"
                                                onChange={(e) => { this.displayName = e.target.value }} />
                                    <TextField className="mt-3"
                                                defaultValue={this.clientTag}
                                                label="Optional: Tag this usage session"
                                                onChange={(e) => { this.clientTag = e.target.value }} />
                                    <div className="push-notification-options mt-4" disabled={!this.state.initializedOneSignal}>
                                        Push Notifications options
                                        <Checkbox className="mt-2 ml-3"
                                                    label="Initialize Call Agent"
                                                    disabled={!this.state.initializedOneSignal}
                                                    checked={this.state.initializeCallAgentAfterPushRegistration}
                                                    onChange={(e, isChecked) => { this.setState({ initializeCallAgentAfterPushRegistration: isChecked })}}/>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3">
                                <PrimaryButton className="primary-button mt-3"
                                    iconProps={{iconName: 'ReleaseGate', style: {verticalAlign: 'middle', fontSize: 'large'}}}
                                    label="Provision an user" 
                                    disabled={this.state.disableInitializeButton}
                                    onClick={() => this.getAcsUserAccessToken()}>
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
