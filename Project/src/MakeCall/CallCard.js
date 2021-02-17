import React from "react";
import { DefaultButton } from 'office-ui-fabric-react'
import StreamMedia from "./StreamMedia";
import AddParticipantPopover from "./AddParticipantPopover";
import RemoteParticipantCard from "./RemoteParticipantCard";
import { Panel, PanelType } from 'office-ui-fabric-react/lib/Panel';
import { Icon } from '@fluentui/react/lib/Icon';
import LocalVideoPreviewCard from './LocalVideoPreviewCard';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { LocalVideoStream } from '@azure/communication-calling';
import { utils } from '../Utils/Utils';
export default class CallCard extends React.Component {
    constructor(props) {
        super(props);
        this.callFinishConnectingResolve = undefined;
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.state = {
            callState: this.call.state,
            callId: this.call.id,
            remoteParticipants: this.call.remoteParticipants,
            allRemoteParticipantStreams: [],
            videoOn: true,
            micMuted: false,
            onHold: this.call.state === 'LocalHold' || this.call.state === 'RemoteHold',
            screenShareOn: this.call.isScreenShareOn,
            cameraDeviceOptions:[],
            speakerDeviceOptions:[],
            microphoneDeviceOptions:[],
            selectedCameraDeviceId: props.selectedCameraDeviceId,
            selectedSpeakerDeviceId: props.selectedSpeakerDeviceId,
            selectedMicrophoneDeviceId: props.selectedMicrophoneDeviceId,
            showSettings: false,
            showLocalVideo: false
        };
    }

    async componentWillMount() {
        if (this.call) {
            const cameraDevices = await this.deviceManager.getCameras();
            const speakerDevices = await this.deviceManager.getSpeakers();
            const microphoneDevices = await this.deviceManager.getMicrophones();

            cameraDevices.map(cameraDevice => { this.state.cameraDeviceOptions.push({key: cameraDevice.id, text: cameraDevice.name}) });
            speakerDevices.map(speakerDevice => { this.state.speakerDeviceOptions.push({key: speakerDevice.id, text: speakerDevice.name}) });
            microphoneDevices.map(microphoneDevice => { this.state.microphoneDeviceOptions.push({key: microphoneDevice.id, text: microphoneDevice.name}) });

            this.deviceManager.on('videoDevicesUpdated', e => {
                e.added.forEach(cameraDevice => { this.state.cameraDeviceOptions.push({key: cameraDevice.id, text: cameraDevice.name}); });

                e.removed.forEach(removedCameraDevice => {
                    this.state.cameraDeviceOptions.forEach(async (value, index) => {
                        if(value.key === removedCameraDevice.id) {
                            this.state.cameraDeviceOptions.splice(index, 1);
                            if(removedCameraDevice.id === this.state.selectedCameraDeviceId) {
                                const cameraDevice = await this.deviceManager.getCameras()[0];
                                this.setState({selectedCameraDeviceId: cameraDevice.id});
                            }
                        }
                    });
                });
            });

            this.deviceManager.on('audioDevicesUpdated', e => {
                e.added.forEach(audioDevice => {
                    if (audioDevice.deviceType === 'Speaker') {
                        this.state.speakerDeviceOptions.push({key: audioDevice.id, text: audioDevice.name});

                    } else if(audioDevice.deviceType === 'Microphone') {
                        this.state.microphoneDeviceOptions.push({key: audioDevice.id, text: audioDevice.name});
                    }
                });

                e.removed.forEach(removedAudioDevice => {
                    if(removedAudioDevice.deviceType === 'Speaker') {
                        this.state.speakerDeviceOptions.forEach(async (value, index) => {
                            if(value.key === removedAudioDevice.id) {
                                this.state.speakerDeviceOptions.splice(index, 1);
                                if(removedAudioDevice.id === this.state.selectedSpeakerDeviceId) {
                                    const speakerDevice = await this.deviceManager.getSpeakers()[0];
                                    await this.deviceManager.selectSpeaker(speakerDevice);
                                    this.setState({selectedSpeakerDeviceId: speakerDevice.id});
                                }
                            }
                        });
                    } else if (removedAudioDevice.deviceType === 'Microphone') {
                        this.state.microphoneDeviceOptions.forEach(async (value, index) => {
                            if(value.key === removedAudioDevice.id) {
                                this.state.microphoneDeviceOptions.splice(index, 1);
                                if(removedAudioDevice.id === this.state.selectedMicrophoneDeviceId) {
                                    const microphoneDevice = await this.deviceManager.getMicrophones()[0];
                                    await this.deviceManager.selectMicrophone(microphoneDevice);
                                    this.setState({selectedMicrophoneDeviceId: microphoneDevice.id});
                                }
                            }
                        });
                    }
                });
            });

            const callStateChanged = () => {
                console.log('Call state changed ', this.state.callState);
                this.setState({callState: this.call.state});

                if (this.state.callState !== 'None' &&
                    this.state.callState !== 'Connecting' &&
                    this.state.callState !== 'Incoming') {
                        if (this.callFinishConnectingResolve) {
                            this.callFinishConnectingResolve();
                        }
                }
                if (this.state.callState === 'Incoming') {
                    this.selectedCameraDeviceId = cameraDevices[0]?.id;
                    this.selectedSpeakerDeviceId = speakerDevices[0]?.id;
                    this.selectedMicrophoneDeviceId = microphoneDevices[0]?.id;
                }
            }
            callStateChanged();
            this.call.on('stateChanged', callStateChanged);

            this.call.on('idChanged', () => {
                console.log('Call id Changed ', this.call.id);
                this.setState({ callId: this.call.id});
            });

            this.call.on('isRecordingActiveChanged', () => {
                console.log('isRecordingActiveChanged ', this.call.isRecordingActive);
            });

            this.call.on('isMicrophoneMutedChanged', () => {
                this.setState({ micMuted: this.call.isMicrophoneMuted });
            });

            this.call.on('isScreenSharingOnChanged', () => {
                this.setState({ screenShareOn: this.call.isScreenShareOn});
            });

            this.call.remoteParticipants.forEach(rp => this.subscribeToRemoteParticipant(rp));
            this.call.on('remoteParticipantsUpdated', e => {
                console.log(`Call=${this.call.callId}, remoteParticipantsUpdated, added=${e.added}, removed=${e.removed}`);
                e.added.forEach(p => {
                    console.log('participantAdded', p);
                    this.subscribeToRemoteParticipant(p);
                    this.setState(prevState => ({ remoteParticipants: [...prevState.remoteParticipants, p] }));
                });
                e.removed.forEach(p => {
                    console.log('participantRemoved', p);
                    this.setState({remoteParticipants: this.state.remoteParticipants.filter(remoteParticipant => { return remoteParticipant !== p })});
                });
            });
        }
    }

    subscribeToRemoteParticipant(participant) {
        participant.on('displayNameChanged', () => {
            console.log('displayNameChanged ', participant.displayName);
        });

        participant.on('stateChanged', () => {
            console.log('Participant state changed', participant.identifier.communicationUserId, participant.state);
            this.setState({remoteParticipants: this.call.remoteParticipants});
        });

        const addToListOfAllRemoteParticipantStreams = (participantStreams) => {
            if(participantStreams) {
                let participantStreamTuples = participantStreams.map(stream => { return { stream, participant }});
                participantStreamTuples.forEach(participantStreamTuple => {
                    if (!this.state.allRemoteParticipantStreams.find((v) => { return v === participantStreamTuple }) ) {
                        this.setState(prevState => ({
                            allRemoteParticipantStreams: [...prevState.allRemoteParticipantStreams, participantStreamTuple]
                        }));
                    }
                })
            }
        }

        const removeFromListOfAllRemoteParticipantStreams = (participantStreams) => {
                participantStreams.forEach(streamToRemove => {
                    const tupleToRemove = this.state.allRemoteParticipantStreams.find((v) => { return v.stream === streamToRemove})
                    if(tupleToRemove) {
                        this.setState({
                            allRemoteParticipantStreams: this.state.allRemoteParticipantStreams.filter(streamTuple => { return streamTuple !== tupleToRemove })
                        });
                    }
                });
        }

        const handleVideoStreamsUpdated = (e) => {
            addToListOfAllRemoteParticipantStreams(e.added);
            removeFromListOfAllRemoteParticipantStreams(e.removed);
        }

        addToListOfAllRemoteParticipantStreams(participant.videoStreams);
        participant.on('videoStreamsUpdated', handleVideoStreamsUpdated);
    }

    async handleAcceptCall() {
        const cameras = await this.deviceManager.getCameras();
        const cameraDevice = cameras[0];
        let localVideoStream;
        if(!cameraDevice || cameraDevice.id === 'camera:') {
            this.props.onShowCameraNotFoundWarning(true);
        } else if (cameraDevice) {
            this.setState({ selectedCameraDeviceId: cameraDevice.id });
            localVideoStream = new LocalVideoStream(cameraDevice);
        }

        const speakers = await this.deviceManager.getSpeakers();
        const speakerDevice = speakers[0];
        if(!speakerDevice || speakerDevice.id === 'speaker:') {
            this.props.onShowSpeakerNotFoundWarning(true);
        } else if(speakerDevice) {
            this.setState({selectedSpeakerDeviceId: speakerDevice.id});
            await this.deviceManager.selectSpeaker(speakerDevice);
        }

        const microphones = await this.deviceManager.getMicrophones();
        const microphoneDevice = microphones[0];
        if(!microphoneDevice || microphoneDevice.id === 'microphone:') {
            this.props.onShowMicrophoneNotFoundWarning(true);
        } else {
            this.setState({selectedMicrophoneDeviceId: microphoneDevice.id});
            await this.deviceManager.selectMicrophone(microphoneDevice);
        }

        this.call.accept({
            videoOptions: this.state.videoOn && cameraDevice ? { localVideoStreams: [localVideoStream] } : undefined
        }).catch((e) => console.error(e));
    }

    getIncomingActionContent() {
        return (
            <>
                <DefaultButton
                    className="answer-button my-3"
                    onClick={() => this.handleAcceptCall()}>
                    <i className="fas fa-phone"></i>Accept
                </DefaultButton>
            </>
        );
    }

    async handleVideoOnOff () {
        try {
            const cameras = await this.deviceManager.getCameras();
            const cameraDeviceInfo = cameras.find(cameraDeviceInfo => {
                return cameraDeviceInfo.id === this.state.selectedCameraDeviceId
            });
            const localVideoStream = new LocalVideoStream(cameraDeviceInfo);

            if (this.call.state === 'None' || 
                this.call.state === 'Connecting' ||
                this.call.state === 'Incoming') {
                    if(this.state.videoOn) {
                        this.setState({ videoOn: false });
                    } else {
                        this.setState({ videoOn: true })
                    }
                    await this.watchForCallFinishConnecting();
                    if(this.state.videoOn) {
                        this.call.startVideo(localVideoStream).catch(error => {});
                    } else {
                        this.call.stopVideo(this.call.localVideoStreams[0]).catch(error => {});
                    }
            } else {
                    if(this.call.localVideoStreams[0]) {
                        await this.call.stopVideo(this.call.localVideoStreams[0]);
                    } else {
                        await this.call.startVideo(localVideoStream);
                    }
            }

            this.setState({ videoOn: this.call.localVideoStreams[0] ? true : false});
        } catch(e) {
            console.error(e);
        }
    }

    async watchForCallFinishConnecting() {
        return new Promise((resolve) => {
            if (this.state.callState !== 'None' && this.state.callState !== 'Connecting' && this.state.callState !== 'Incoming') {
                resolve();
            } else {
                this.callFinishConnectingResolve = resolve;
            }
        }).then(() => {
            this.callFinishConnectingResolve = undefined;
        });
    }

    async handleMicOnOff() {
        try {
            if (!this.call.isMicrophoneMuted) {
                await this.call.mute();
            } else {
                await this.call.unmute();
            }
            this.setState({micMuted: this.call.isMicrophoneMuted});
        } catch(e) {
            console.error(e);
        }
    }

    async handleHoldUnhold() {
        try {
            if(this.call.state === 'LocalHold' || this.call.state === 'RemoteHold') {
                this.call.resume();
            } else {
                this.call.hold();
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleScreenSharingOnOff() {
        try {
            if (this.call.isScreenSharingOn) {
                await this.call.stopScreenSharing()
            } else {
                await this.call.startScreenSharing();
            }
            this.setState({screenShareOn: this.call.isScreenSharingOn});
        } catch(e) {
            console.error(e);
        }
    }

    cameraDeviceSelectionChanged = async (event, item) => {
        const cameras = await this.deviceManager.getCameras();
        const cameraDeviceInfo = cameras.find(cameraDeviceInfo => { return cameraDeviceInfo.id === item.key });
        const localVideoStream = this.call.localVideoStreams[0];
        localVideoStream.switchSource(cameraDeviceInfo);
        this.setState({selectedCameraDeviceId: cameraDeviceInfo.id});
    };

    speakerDeviceSelectionChanged = async (event, item) => {
        const speakers = await this.deviceManager.getSpeakers();
        const speakerDeviceInfo = speakers.find(speakerDeviceInfo => { return speakerDeviceInfo.id === item.key });
        this.deviceManager.selectSpeaker(speakerDeviceInfo);
        this.setState({selectedSpeakerDeviceId: speakerDeviceInfo.id});
    };

    microphoneDeviceSelectionChanged = async (event, item) => {
        const microphones = await this.deviceManager.getMicrophones();
        const microphoneDeviceInfo = microphones.find(microphoneDeviceInfo => { return microphoneDeviceInfo.id === item.key });
        this.deviceManager.selectMicrophone(microphoneDeviceInfo);
        this.setState({selectedMicrophoneDeviceId: microphoneDeviceInfo.id});
    };

    render() {
        return (
            <div className="ms-Grid mt-2">
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg6">
                        <h2>{this.state.callState !== 'Connected' ? `${this.state.callState}...` : `Connected`}</h2>
                    </div>
                    <div className="ms-Grid-col ms-lg6 text-right">
                        {
                            this.call &&
                            <h2>Call Id: {this.state.callId}</h2>
                        }
                    </div>
                </div>
                <div className="ms-Grid-row">
                    {
                        this.state.callState === 'Connected' &&
                        <div className="ms-Grid-col ms-lg3 ms-sm12">
                            <div className="participants-panel mt-1 mb-3">
                                    <div className="participants-panel-title custom-row text-center">
                                        <AddParticipantPopover call={this.call}/>
                                    </div>
                                    {
                                        this.state.remoteParticipants.length === 0 &&
                                        <p className="text-center">No other participants currently in the call</p>
                                    }
                                    <ul className="participants-panel-list">
                                        {
                                            this.call.remoteParticipants.map(remoteParticipant =>
                                                <RemoteParticipantCard key={`${this.call.id}-${utils.getIdentifierText(remoteParticipant.identifier)}`} remoteParticipant={remoteParticipant} call={this.call}/>
                                            )
                                        }
                                    </ul>
                            </div>
                            <div>
                                {
                                    this.state.showLocalVideo &&
                                    <div className="mb-3">
                                        <LocalVideoPreviewCard selectedCameraDeviceId={this.state.selectedCameraDeviceId} deviceManager={this.deviceManager}/>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                    <div className={ this.state.callState === 'Connected' ? `ms-Grid-col ms-lg9 ms-sm12`: 'ms-Grid-col ms-lg12 ms-sm12'}>
                        {
                            <div className="video-grid-row">
                                {
                                    this.state.allRemoteParticipantStreams.map(v =>
                                        <StreamMedia key={`${utils.getIdentifierText(v.participant.identifier)}-${v.stream.mediaStreamType}-${v.stream.id}`} stream={v.stream} remoteParticipant={v.participant}/>
                                    )
                                }
                            </div>
                        }
                        <div className="my-4">
                            {
                                this.state.callState !== 'Connected' &&
                                <div className="custom-row">
                                    <div className="ringing-loader mb-4"></div>
                                </div>
                            }
                            <div className="text-center">
                                    <span className="in-call-button"
                                        title={`Turn your video ${this.state.videoOn ? 'off' : 'on'}`}
                                        variant="secondary"
                                        onClick={() => this.handleVideoOnOff()}>
                                        {
                                            this.state.videoOn &&
                                            <Icon iconName="Video"/>
                                        }
                                        {
                                            !this.state.videoOn &&
                                            <Icon iconName="VideoOff"/>
                                        }
                                    </span>
                                    <span className="in-call-button"
                                        title={`${this.state.micMuted ? 'Unmute' : 'Mute'} your microphone`}
                                        variant="secondary"
                                        onClick={() => this.handleMicOnOff()}>
                                        {
                                            this.state.micMuted &&
                                            <Icon iconName="MicOff2"/>
                                        }
                                        {
                                            !this.state.micMuted &&
                                            <Icon iconName="Microphone"/>
                                        }
                                    </span>
                                    {
                                        (this.state.callState === 'Connected' || this.state.callState === 'LocalHold' || this.state.callState === 'RemoteHold') &&
                                        <span className="in-call-button"
                                            title={`${this.state.callState === 'LocalHold' || this.state.callState === 'RemoteHold' ? 'Unhold' : 'Hold'} call`} 
                                            variant="secondary"
                                            onClick={() => this.handleHoldUnhold()}>
                                            {
                                                (this.state.callState === 'LocalHold' || this.state.callState === 'RemoteHold') &&
                                                <Icon iconName="Pause"/>
                                            }
                                            {
                                                this.state.callState === 'Connected' &&
                                                <Icon iconName="Play"/>
                                            }
                                        </span>
                                    }
                                    <span className="in-call-button"
                                        title={`${this.state.screenShareOn ? 'Stop' : 'Start'} sharing your screen`}
                                        variant="secondary"
                                        onClick={() => this.handleScreenSharingOnOff()}>
                                        {
                                            !this.state.screenShareOn &&
                                            <Icon iconName="TVMonitor"/>
                                        }
                                        {
                                            this.state.screenShareOn &&
                                            <Icon iconName="CircleStop"/>
                                        }
                                    </span>
                                    <span className="in-call-button"
                                        title="Settings"
                                        variant="secondary"
                                        onClick={() => this.setState({showSettings: true})}>
                                        <Icon iconName="Settings"/>
                                    </span>
                                    <span className="in-call-button"
                                        onClick={() => this.call.hangUp({forEveryone: false}).catch((e) => console.error(e))}>
                                        <Icon iconName="DeclineCall"/>
                                    </span>
                                <Panel type={PanelType.medium}
                                    isLightDismiss
                                    isOpen={this.state.showSettings}
                                    onDismiss={() => this.setState({showSettings: false})}
                                    closeButtonAriaLabel="Close"
                                    headerText="Settings">
                                        <div className="pl-2 mt-3">
                                            <h3>Video settings</h3>
                                            <div className="pl-2">
                                                <span>
                                                    <h4>Camera preview</h4>
                                                </span>
                                                <DefaultButton onClick={() => this.setState({showLocalVideo: !this.state.showLocalVideo})}>
                                                    Show/Hide
                                                </DefaultButton>
                                                {
                                                    this.state.cameraDeviceOptions.length > 0  && this.state.callState === 'Connected' &&
                                                    <Dropdown
                                                        selectedKey={this.state.selectedCameraDeviceId}
                                                        onChange={this.cameraDeviceSelectionChanged}
                                                        label={'Camera'}
                                                        options={this.state.cameraDeviceOptions}
                                                        disabled={this.deviceManager.getCameras().length === 0 }
                                                        placeHolder={this.deviceManager.getCameras().length === 0 ? 'No camera devices found' :
                                                                    this.state.selectedCameraDeviceId ? '' : 'Select camera'}
                                                        styles={{dropdown: { width: 400 }}}
                                                    />
                                                }
                                            </div>
                                        </div>
                                        <div className="pl-2 mt-4">
                                            <h3>Sound Settings</h3>
                                            <div className="pl-2">
                                                {
                                                    this.state.speakerDeviceOptions.length > 0 && this.state.callState === 'Connected' &&
                                                    <Dropdown
                                                        selectedKey={this.state.selectedSpeakerDeviceId}
                                                        onChange={this.speakerDeviceSelectionChanged}
                                                        options={this.state.speakerDeviceOptions}
                                                        label={'Speaker'}
                                                        disabled={this.deviceManager.getSpeakers().length === 0}
                                                        placeHolder={this.deviceManager.getSpeakers().length === 0 ? 'No speaker devices found' :
                                                                    this.state.selectedSpeakerDeviceId ? '' : 'Select speaker'}
                                                        styles={{dropdown: { width: 400 }}}
                                                    />
                                                }
                                                {
                                                    this.state.microphoneDeviceOptions.length > 0 && this.state.callState === 'Connected' &&
                                                    <Dropdown
                                                        selectedKey={this.state.selectedMicrophoneDeviceId}
                                                        onChange={this.microphoneDeviceSelectionChanged}
                                                        options={this.state.microphoneDeviceOptions}
                                                        label={'Microphone'}
                                                        disabled={this.deviceManager.getMicrophones().length === 0}
                                                        placeHolder={this.deviceManager.getMicrophones().length === 0 ? 'No microphone devices found' :
                                                                    this.state.selectedMicrophoneDeviceId ? '' : 'Select microphone'}
                                                        styles={{dropdown: { width: 400 }}}
                                                    />
                                                }
                                            </div>
                                        </div>
                                </Panel>
                            </div>
                            <div className="text-center">
                            {
                                this.call.direction === 'Incoming' && this.call.state === 'Incoming' ? this.getIncomingActionContent() : undefined
                            }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}