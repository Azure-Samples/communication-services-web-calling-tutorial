import React from "react";
import { TextField, PrimaryButton } from 'office-ui-fabric-react'
import { utils } from "../Utils/Utils";
import { v4 as uuid } from 'uuid';

export default class Login extends React.Component {
    constructor(props) {
        super(props);
        this.userDetailsResponse = undefined;
        this.displayName = undefined;
        this.clientTag = uuid();
        this.state = {
            showUserProvisioningAndSdkInitializationCode: false,
            showSpinner: false,
            disableInitializeButton: false,
            loggedIn: false
        }
    }

    provisionNewUser = async () => {
        try {
            this.setState({ showSpinner: true, disableInitializeButton: true });
            this.userDetailsResponse = await utils.provisionNewUser();
            this.setState({ id: utils.getIdentifierText(this.userDetailsResponse.user) });
            await this.props.onLoggedIn({ id: this.state.id, token: this.userDetailsResponse.token, displayName: this.displayName, clientTag: this.clientTag });
            this.setState({ loggedIn: true });
        } catch (error) {
            console.log(error);
        } finally {
            this.setState({ disableInitializeButton: false, showSpinner: false });
        }
    }

    render() {
        const userProvisioningAndSdkInitializationCode = `
/**************************************************************************************
 *   User token provisioning service should be set up in a trusted backend service.   *
 *   Client applications will make requests to this service for gettings tokens.      *
 **************************************************************************************/
import  { CommunicationIdentityClient } from @azure/communication-administration;
const communicationIdentityClient = new CommunicationIdentityClient(<RESOURCE CONNECTION STRING>);
app.get('/tokens/provisionUser', async (request, response) => {
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
        const response = (await fetch('/tokens/provisionUser')).json();
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
                    {
                        this.state.showUserProvisioningAndSdkInitializationCode &&
                        <pre>
                            <code style={{color: '#b3b0ad'}}>
                                {userProvisioningAndSdkInitializationCode}
                            </code>
                        </pre>
                    }
                    <div>The ACS Administration SDK can be used to create a user access token which authenticates the calling clients. </div>
                    <div>The example code shows how to use the ACS Administration SDK from a backend service. A walkthrough of integrating the ACS Administration SDK can be found on <a className="sdk-docs-link" target="_blank" href="https://docs.microsoft.com/en-us/azure/communication-services/quickstarts/access-tokens?pivots=programming-language-javascript">Microsoft Docs</a></div>
                    {
                        this.state.loggedIn && 
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
                        !this.state.loggedIn &&
                        <div>
                            <div className="ms-Grid-row">
                                <div className="ms-Grid-col ms-sm12 ms-lg6 ms-xl6 ms-xxl3">
                                    <TextField className="mt-3"
                                                defaultValue={undefined}
                                                label="Optional display name"
                                                onChange={(e) => { this.displayName = e.target.value }} />
                                    <TextField className="mt-3"
                                                defaultValue={this.clientTag}
                                                label="Optional: Tag this usage session"
                                                onChange={(e) => { this.clientTag = e.target.value }} />
                                </div>
                            </div>
                            <div className="mt-1">
                                <PrimaryButton className="primary-button mt-3"
                                    iconProps={{iconName: 'ReleaseGate', style: {verticalAlign: 'middle', fontSize: 'large'}}}
                                    label="Provision an user" 
                                    disabled={this.state.disableInitializeButton}
                                    onClick={() => this.provisionNewUser()}>
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
