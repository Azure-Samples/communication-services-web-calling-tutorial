import React from "react";
import { MessageBar, MessageBarType, DefaultButton } from 'office-ui-fabric-react'
import { Toggle } from '@fluentui/react/lib/Toggle';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import { FunctionalStreamRenderer as StreamRenderer} from "./FunctionalStreamRenderer";
import AddParticipantPopover from "./AddParticipantPopover";
import RemoteParticipantCard from "./RemoteParticipantCard";
import { Panel, PanelType } from 'office-ui-fabric-react/lib/Panel';
import { Icon } from '@fluentui/react/lib/Icon';
import LocalVideoPreviewCard from './LocalVideoPreviewCard';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { LocalVideoStream, Features, LocalAudioStream } from '@azure/communication-calling';
import { utils } from '../Utils/Utils';
import CustomVideoEffects from "./RawVideoAccess/CustomVideoEffects";
import VideoEffectsContainer from './VideoEffects/VideoEffectsContainer';
import { Label } from '@fluentui/react/lib/Label';
import { AzureLogger } from '@azure/logger';
import VolumeVisualizer from "./VolumeVisualizer";
import CurrentCallInformation from "./CurrentCallInformation";

export default class CallCard extends React.Component {
    constructor(props) {
        super(props);
        this.callFinishConnectingResolve = undefined;
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.remoteVolumeLevelSubscription = undefined;
        this.handleRemoteVolumeSubscription = undefined;
        this.maximumNumberOfRenderers = 4;
        this.state = {
            callState: this.call.state,
            callId: this.call.id,
            remoteParticipants: this.call.remoteParticipants,
            allRemoteParticipantStreams: [],
            videoOn: !!this.call.localVideoStreams[0],
            micMuted: false,
            incomingAudioMuted: false,
            onHold: this.call.state === 'LocalHold' || this.call.state === 'RemoteHold',
            screenShareOn: this.call.isScreenShareOn,
            outgoingAudioMediaAccessActive: false,
            cameraDeviceOptions: props.cameraDeviceOptions ? props.cameraDeviceOptions : [],
            speakerDeviceOptions: props.speakerDeviceOptions ? props.speakerDeviceOptions : [],
            microphoneDeviceOptions: props.microphoneDeviceOptions ? props.microphoneDeviceOptions : [],
            selectedCameraDeviceId: props.selectedCameraDeviceId,
            selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id,
            selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id,
            showSettings: false,
            showLocalVideo: false,
            callMessage: undefined,
            dominantSpeakerMode: false,
            dominantRemoteParticipant: undefined,
            logMediaStats: false,
            sentResolution: '',
            remoteVolumeIndicator: undefined,
            remoteVolumeLevel: undefined,
            mediaCollector: undefined
        };
    }

    componentWillUnmount() {
        this.call.off('stateChanged', () => {});
        this.deviceManager.off('videoDevicesUpdated', () => {});
        this.deviceManager.off('audioDevicesUpdated', () => {});
        this.deviceManager.off('selectedSpeakerChanged', () => {});
        this.deviceManager.off('selectedMicrophoneChanged', () => {});
        this.call.off('localVideoStreamsUpdated', () => {});
        this.call.off('idChanged', () => {});
        this.call.off('isMutedChanged', () => {});
        this.call.off('isIncomingAudioMutedChanged', () => {});
        this.call.off('isScreenSharingOnChanged', () => {});
        this.call.off('remoteParticipantsUpdated', () => {});
        this.state.mediaCollector?.off('sampleReported', () => {});
        this.state.mediaCollector?.off('summaryReported', () => {});
        this.call.feature(Features.DominantSpeakers).off('dominantSpeakersChanged', () => {});
    }

    componentDidMount() {
        if (this.call) {
            this.deviceManager.on('videoDevicesUpdated', async e => {
                let newCameraDeviceToUse = undefined;
                e.added.forEach(addedCameraDevice => {
                    newCameraDeviceToUse = addedCameraDevice;
                    const addedCameraDeviceOption = { key: addedCameraDevice.id, text: addedCameraDevice.name };
                    this.setState(prevState => ({
                        ...prevState,
                        cameraDeviceOptions: [...prevState.cameraDeviceOptions, addedCameraDeviceOption]
                    }));
                });
                // When connecting a new camera, ts device manager automatically switches to use this new camera and
                // this.call.localVideoStream[0].source is never updated. Hence I have to do the following logic to update
                // this.call.localVideoStream[0].source to the newly added camera. This is a bug. Under the covers, this.call.localVideoStreams[0].source
                // should have been updated automatically by the sdk.
                if (newCameraDeviceToUse) {
                    try {
                        await this.call.localVideoStreams[0]?.switchSource(newCameraDeviceToUse);
                        this.setState({ selectedCameraDeviceId: newCameraDeviceToUse.id });
                    } catch {
                        console.error('Failed to switch to newly added video device', error);
                    }
                }

                e.removed.forEach(removedCameraDevice => {
                    this.setState(prevState => ({
                        ...prevState,
                        cameraDeviceOptions: prevState.cameraDeviceOptions.filter(option => { return option.key !== removedCameraDevice.id })
                    }))
                });

                // If the current camera being used is removed, pick a new random one
                if (!this.state.cameraDeviceOptions.find(option => { return option.key === this.state.selectedCameraDeviceId })) {
                    const newSelectedCameraId = this.state.cameraDeviceOptions[0]?.key;
                    const cameras = await this.deviceManager.getCameras();
                    const videoDeviceInfo = cameras.find(c => { return c.id === newSelectedCameraId });
                    await this.call.localVideoStreams[0]?.switchSource(videoDeviceInfo);
                    this.setState({ selectedCameraDeviceId: newSelectedCameraId });
                }
            });

            this.deviceManager.on('audioDevicesUpdated', e => {
                e.added.forEach(addedAudioDevice => {
                    const addedAudioDeviceOption = { key: addedAudioDevice.id, text: addedAudioDevice.name };
                    if (addedAudioDevice.deviceType === 'Speaker') {
                        this.setState(prevState => ({
                            ...prevState,
                            speakerDeviceOptions: [...prevState.speakerDeviceOptions, addedAudioDeviceOption]
                        }));
                    } else if (addedAudioDevice.deviceType === 'Microphone') {
                        this.setState(prevState => ({
                            ...prevState,
                            microphoneDeviceOptions: [...prevState.microphoneDeviceOptions, addedAudioDeviceOption]
                        }));
                    }
                });

                e.removed.forEach(removedAudioDevice => {
                    if (removedAudioDevice.deviceType === 'Speaker') {
                        this.setState(prevState => ({
                            ...prevState,
                            speakerDeviceOptions: prevState.speakerDeviceOptions.filter(option => { return option.key !== removedAudioDevice.id })
                        }))
                    } else if (removedAudioDevice.deviceType === 'Microphone') {
                        this.setState(prevState => ({
                            ...prevState,
                            microphoneDeviceOptions: prevState.microphoneDeviceOptions.filter(option => { return option.key !== removedAudioDevice.id })
                        }))
                    }
                });
            });

            this.deviceManager.on('selectedSpeakerChanged', () => {
                this.setState({ selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id });
            });

            this.deviceManager.on('selectedMicrophoneChanged', () => {
                this.setState({ selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id });
            });

            const callStateChanged = () => {
                console.log('Call state changed ', this.call.state);
                if (this.call.state !== 'None' &&
                    this.call.state !== 'Connecting' &&
                    this.call.state !== 'Incoming') {
                    if (this.callFinishConnectingResolve) {
                        this.callFinishConnectingResolve();
                    }
                }
                if (this.call.state === 'Incoming') {
                    this.setState({ selectedCameraDeviceId: cameraDevices[0]?.id });
                    this.setState({ selectedSpeakerDeviceId: speakerDevices[0]?.id });
                    this.setState({ selectedMicrophoneDeviceId: microphoneDevices[0]?.id });
                }

                if (this.call.state !== 'Disconnected') {
                    this.setState({ callState: this.call.state });
                }
            }
            callStateChanged();
            this.call.on('stateChanged', callStateChanged);

            this.call.localVideoStreams.forEach(lvs => {
                this.setState({ videoOn: true});
            });
            this.call.on('localVideoStreamsUpdated', e => {
                e.added.forEach(lvs => {
                    this.setState({ videoOn: true });
                });
                e.removed.forEach(lvs => {
                    this.setState({ videoOn: false });
                });
            });

            this.call.on('idChanged', () => {
                console.log('Call id Changed ', this.call.id);
                this.setState({ callId: this.call.id });
            });

            this.call.on('isMutedChanged', () => {
                console.log('Local microphone muted changed ', this.call.isMuted);
                this.setState({ micMuted: this.call.isMuted });
            });

            this.call.on('isIncomingAudioMutedChanged', () => {
                console.log('Incoming audio muted changed  ', this.call.isIncomingAudioMuted);
                this.setState({ incomingAudioMuted: this.call.isIncomingAudioMuted });
            });

            this.call.on('isScreenSharingOnChanged', () => {
                this.setState({ screenShareOn: this.call.isScreenShareOn });
            });

            this.call.remoteParticipants.forEach(rp => this.subscribeToRemoteParticipant(rp));
            this.call.on('remoteParticipantsUpdated', e => {
                console.log(`Call=${this.call.callId}, remoteParticipantsUpdated, added=${e.added}, removed=${e.removed}`);
                e.added.forEach(p => {
                    console.log('participantAdded', p);
                    this.subscribeToRemoteParticipant(p);
                });
                e.removed.forEach(p => {
                    console.log('participantRemoved', p);
                    if(p.callEndReason) {
                        this.setState(prevState => ({
                            ...prevState,
                            callMessage: `${prevState.callMessage ? prevState.callMessage + `\n` : ``}
                                        Remote participant ${utils.getIdentifierText(p.identifier)} disconnected: code: ${p.callEndReason.code}, subCode: ${p.callEndReason.subCode}.`
                        }));
                    }
                    this.setState({ remoteParticipants: this.state.remoteParticipants.filter(remoteParticipant => { return remoteParticipant !== p }) });
                    this.setState({ allRemoteParticipantStreams: this.state.allRemoteParticipantStreams.filter(s => { return s.participant !== p }) });
                    p.off('videoStreamsUpdated', () => {});
                });
            });
            const mediaCollector = this.call.feature(Features.MediaStats).createCollector();
            this.setState({ mediaCollector });
            mediaCollector.on('sampleReported', (data) => {
                if (this.state.logMediaStats) {
                    AzureLogger.log(`${(new Date()).toISOString()} MediaStats sample: ${JSON.stringify(data)}`);
                }
                let sentResolution = '';
                if (data?.video?.send?.length) {
                    if (data.video.send[0].frameWidthSent && data.video.send[0].frameHeightSent) {
                        sentResolution = `${data.video.send[0].frameWidthSent}x${data.video.send[0].frameHeightSent}`
                    }
                }
                if (this.state.sentResolution !== sentResolution) {
                    this.setState({ sentResolution });
                }
                let stats = {};
                if (this.state.logMediaStats) {
                    if (data?.video?.receive?.length) {
                        data.video.receive.forEach(v => {
                            stats[v.streamId] = v;
                        });
                    }
                    if (data?.screenShare?.receive?.length) {
                        data.screenShare.receive.forEach(v => {
                            stats[v.streamId] = v;
                        });
                    }
                }
                this.state.allRemoteParticipantStreams.forEach(v => {
                    let renderer = v.streamRendererComponentRef.current;
                    renderer?.updateReceiveStats(stats[v.stream.id]);
                });
            });
            mediaCollector.on('summaryReported', (data) => {
                if (this.state.logMediaStats) {
                    AzureLogger.log(`${(new Date()).toISOString()} MediaStats summary: ${JSON.stringify(data)}`);
                }
            });

            const dominantSpeakersChangedHandler = async () => {
                try {
                    if(this.state.dominantSpeakerMode) {

                        const newDominantSpeakerIdentifier = this.call.feature(Features.DominantSpeakers).dominantSpeakers.speakersList[0];
                        if (newDominantSpeakerIdentifier) {
                            console.log(`DominantSpeaker changed, new dominant speaker: ${newDominantSpeakerIdentifier ? utils.getIdentifierText(newDominantSpeakerIdentifier) : `None`}`);

                            // Set the new dominant remote participant
                            const newDominantRemoteParticipant = utils.getRemoteParticipantObjFromIdentifier(this.call, newDominantSpeakerIdentifier);

                            // Get the new dominant remote participant's stream tuples
                            const streamsToRender = [];
                            for (const streamTuple of this.state.allRemoteParticipantStreams) {
                                if (streamTuple.participant === newDominantRemoteParticipant && streamTuple.stream.isAvailable) {
                                    streamsToRender.push(streamTuple);
                                    if(!streamTuple.streamRendererComponentRef.current.getRenderer()) {
                                        await streamTuple.streamRendererComponentRef.current.createRenderer();
                                    };
                                }
                            }

                            const previousDominantSpeaker = this.state.dominantRemoteParticipant;
                            this.setState({ dominantRemoteParticipant: newDominantRemoteParticipant });

                            if(previousDominantSpeaker) {
                                // Remove the old dominant remote participant's streams
                                this.state.allRemoteParticipantStreams.forEach(streamTuple => {
                                    if (streamTuple.participant === previousDominantSpeaker) {
                                        streamTuple.streamRendererComponentRef.current.disposeRenderer();
                                    }
                                });
                            }

                            // Render the new dominany speaker's streams
                            streamsToRender.forEach(streamTuple => {
                                streamTuple.streamRendererComponentRef.current.attachRenderer();
                            })

                        } else {
                            console.warn('New dominant speaker is undefined');
                        }
                    }
                } catch (error) {
                    console.error(error);
                }
            };

            const dominantSpeakerIdentifier = this.call.feature(Features.DominantSpeakers).dominantSpeakers.speakersList[0];
            if(dominantSpeakerIdentifier) {
                this.setState({ dominantRemoteParticipant: utils.getRemoteParticipantObjFromIdentifier(dominantSpeakerIdentifier) })
            }
            this.call.feature(Features.DominantSpeakers).on('dominantSpeakersChanged', dominantSpeakersChangedHandler);

            const capabilitiesFeature =  this.call.feature(Features.Capabilities);
            const capabilities =  this.call.feature(Features.Capabilities).capabilities;
            capabilitiesFeature.on('capabilitiesChanged', () => {
                const updatedCapabilities  = capabilitiesFeature.capabilities;
            });
        }
    }

    subscribeToRemoteParticipant(participant) {
        if (!this.state.remoteParticipants.find((p) => { return p === participant })) {
            this.setState(prevState => ({
                ...prevState,
                remoteParticipants: [...prevState.remoteParticipants, participant]
            }));
        }

        const addToListOfAllRemoteParticipantStreams = (participantStreams) => {
            if (participantStreams) {
                let participantStreamTuples = participantStreams.map(stream => { return { stream, participant, streamRendererComponentRef: React.createRef() }});
                participantStreamTuples.forEach(participantStreamTuple => {
                    if (!this.state.allRemoteParticipantStreams.find((v) => { return v === participantStreamTuple })) {
                        this.setState(prevState => ({
                            ...prevState,
                            allRemoteParticipantStreams: [...prevState.allRemoteParticipantStreams, participantStreamTuple]
                        }));
                    }
                })
            }
        }

        const removeFromListOfAllRemoteParticipantStreams = (participantStreams) => {
            participantStreams.forEach(streamToRemove => {
                const tupleToRemove = this.state.allRemoteParticipantStreams.find((v) => { return v.stream === streamToRemove })
                if (tupleToRemove) {
                    this.setState({
                        ...prevState,
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

    async handleVideoOnOff() {
        try {
            const cameras = await this.deviceManager.getCameras();
            const cameraDeviceInfo = cameras.find(cameraDeviceInfo => {
                return cameraDeviceInfo.id === this.state.selectedCameraDeviceId
            });
            let selectedCameraDeviceId = this.state.selectedCameraDeviceId;
            let localVideoStream
            if (this.state.selectedCameraDeviceId) {
                localVideoStream = new LocalVideoStream(cameraDeviceInfo);

            } else if (!this.state.videoOn) {
                const cameras = await this.deviceManager.getCameras();
                selectedCameraDeviceId = cameras[0].id;
                localVideoStream = new LocalVideoStream(cameras[0]);
            }

            if (this.call.state === 'None' ||
                this.call.state === 'Connecting' ||
                this.call.state === 'Incoming') {
                if (this.state.videoOn) {
                    this.setState({ videoOn: false });
                } else {
                    this.setState({ videoOn: true, selectedCameraDeviceId })
                }
                await this.watchForCallFinishConnecting();
                if (this.state.videoOn) {
                    this.call.startVideo(localVideoStream).catch(error => { });
                } else {
                    this.call.stopVideo(this.call.localVideoStreams[0]).catch(error => { });
                }
            } else {
                if (this.call.localVideoStreams[0]) {
                    await this.call.stopVideo(this.call.localVideoStreams[0]);
                } else {
                    await this.call.startVideo(localVideoStream);
                }
            }

            this.setState({ videoOn: this.call.localVideoStreams[0] ? true : false });
        } catch (e) {
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
            if (!this.call.isMuted) {
                await this.call.mute();
            } else {
                await this.call.unmute();
            }
            this.setState({ micMuted: this.call.isMuted });
        } catch (e) {
            console.error(e);
        }
    }



    async handleIncomingAudioOnOff() {
        try {
            if (!this.call.isIncomingAudioMuted) {
                await this.call.muteIncomingAudio();
            } else {
                await this.call.unmuteIncomingAudio();
            }
            this.setState({ incomingAudioMuted: this.call.isIncomingAudioMuted });
        } catch (e) {
            console.error(e);
        }
    }

    async handleHoldUnhold() {
        try {
            if (this.call.state === 'LocalHold') {
                this.call.resume();
            } else {
                this.call.hold();
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleOutgoingAudioEffect() {
        if (this.state.outgoingAudioMediaAccessActive) {
            this.call.stopAudio();
        } else {
            this.startOutgoingAudioEffect();
        }

        this.setState(prevState => ({
            ...prevState,
            outgoingAudioMediaAccessActive: !prevState.outgoingAudioMediaAccessActive
        }));
    }

    async handleMediaStatsLogState() {
        this.setState(prevState => ({
            ...prevState,
            logMediaStats: !prevState.logMediaStats
        }));
    }

    getDummyAudioStream() {
        const context = new AudioContext();
        const dest = context.createMediaStreamDestination();
        const os = context.createOscillator();
        os.type = 'sine';
        os.frequency.value = 500;
        os.connect(dest);
        os.start();
        const { stream } = dest;
        return stream;
    }

    async startOutgoingAudioEffect() {
        const stream = this.getDummyAudioStream();
        const customLocalAudioStream = new LocalAudioStream(stream);
        this.call.startAudio(customLocalAudioStream);
    }

    async handleScreenSharingOnOff() {
        try {
            if (this.call.isScreenSharingOn) {
                await this.call.stopScreenSharing()
            } else {
                await this.call.startScreenSharing();
            }
            this.setState({ screenShareOn: this.call.isScreenSharingOn });
        } catch (e) {
            console.error(e);
        }
    }

    async toggleDominantSpeakerMode() {
        try {
            if (this.state.dominantSpeakerMode) {
                // Turn off dominant speaker mode
                this.setState({ dominantSpeakerMode: false });
                // Render all remote participants's streams
                for (const streamTuple of this.state.allRemoteParticipantStreams) {
                    if(streamTuple.stream.isAvailable && !streamTuple.streamRendererComponentRef.current.getRenderer()) {
                        await streamTuple.streamRendererComponentRef.current.createRenderer();
                        streamTuple.streamRendererComponentRef.current.attachRenderer();
                    }
                }
            } else {
                // Turn on dominant speaker mode
                this.setState({ dominantSpeakerMode: true });
                // Dispose of all remote participants's stream renderers
                const dominantSpeakerIdentifier = this.call.feature(Features.DominantSpeakers).dominantSpeakers.speakersList[0];
                if(!dominantSpeakerIdentifier) {
                    this.state.allRemoteParticipantStreams.forEach(v => {
                        v.streamRendererComponentRef.current.disposeRenderer();
                    });

                    // Return, no action needed
                    return;
                }

                // Set the dominant remote participant obj
                const dominantRemoteParticipant = utils.getRemoteParticipantObjFromIdentifier(this.call, dominantSpeakerIdentifier);
                this.setState({ dominantRemoteParticipant: dominantRemoteParticipant });
                // Dispose of all the remote participants's stream renderers except for the dominant speaker
                this.state.allRemoteParticipantStreams.forEach(v => {
                    if(v.participant !== dominantRemoteParticipant) {
                        v.streamRendererComponentRef.current.disposeRenderer();
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }

    cameraDeviceSelectionChanged = async (event, item) => {
        const cameras = await this.deviceManager.getCameras();
        const cameraDeviceInfo = cameras.find(cameraDeviceInfo => { return cameraDeviceInfo.id === item.key });
        const localVideoStream = this.call.localVideoStreams[0];
        if (localVideoStream) {
            localVideoStream.switchSource(cameraDeviceInfo);
        }
        this.setState({ selectedCameraDeviceId: cameraDeviceInfo.id });
    };

    speakerDeviceSelectionChanged = async (event, item) => {
        const speakers = await this.deviceManager.getSpeakers();
        const speakerDeviceInfo = speakers.find(speakerDeviceInfo => { return speakerDeviceInfo.id === item.key });
        this.deviceManager.selectSpeaker(speakerDeviceInfo);
        this.setState({ selectedSpeakerDeviceId: speakerDeviceInfo.id });
    };

    microphoneDeviceSelectionChanged = async (event, item) => {
        const microphones = await this.deviceManager.getMicrophones();
        const microphoneDeviceInfo = microphones.find(microphoneDeviceInfo => { return microphoneDeviceInfo.id === item.key });
        this.deviceManager.selectMicrophone(microphoneDeviceInfo);
        this.setState({ selectedMicrophoneDeviceId: microphoneDeviceInfo.id });
    };

    updateStreamList() {
        const allStreamsBackup = [...this.state.allRemoteParticipantStreams];
        this.setState({ allRemoteParticipantStreams: [] });
        setTimeout(() => this.setState({allRemoteParticipantStreams: [...allStreamsBackup]}), 0);
    }
    render() {
        return (
            <div className="ms-Grid mt-2">
                <div className="ms-Grid-row">
                    {
                        this.state.callMessage &&
                        <MessageBar
                            messageBarType={MessageBarType.warn}
                            isMultiline={true}
                            onDismiss={() => { this.setState({ callMessage: undefined }) }}
                            dismissButtonAriaLabel="Close">
                            <b>{this.state.callMessage}</b>
                        </MessageBar>
                    }
                </div>
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg6">
                        <h2>{this.state.callState !== 'Connected' ? `${this.state.callState}...` : `Connected`}</h2>
                    </div>
                    {
                        this.call &&
                        <CurrentCallInformation sentResolution={this.state.sentResolution} call={this.call} />
                    }
                </div>
                <div className="ms-Grid-row">
                    {
                        this.state.callState === 'Connected' &&
                        <div className="ms-Grid-col ms-sm12 ms-lg12 ms-xl12 ms-xxl3">
                            <div className="participants-panel mt-1 mb-3">
                                <Toggle label={
                                        <div>
                                            Dominant Speaker mode{' '}
                                            <TooltipHost content={`Render the most dominant speaker's video streams only or render all remote participant video streams`}>
                                                <Icon iconName="Info" aria-label="Info tooltip" />
                                            </TooltipHost>
                                        </div>
                                    }
                                    styles={{
                                        text : { color: '#edebe9' },
                                        label: { color: '#edebe9' },
                                    }}
                                    inlineLabel
                                    onText="On"
                                    offText="Off"
                                    onChange={() => { this.toggleDominantSpeakerMode()}}
                                />
                                {
                                    this.state.dominantSpeakerMode &&
                                    <div>
                                        Current dominant speaker: {this.state.dominantRemoteParticipant ? utils.getIdentifierText(this.state.dominantRemoteParticipant.identifier) : `None`}
                                    </div>
                                }
                                <div className="participants-panel-title custom-row text-center">
                                    <AddParticipantPopover call={this.call} />
                                </div>
                                {
                                    this.state.remoteParticipants.length === 0 &&
                                    <p className="text-center">No other participants currently in the call</p>
                                }
                                <ul className="participants-panel-list">
                                    {
                                        this.state.remoteParticipants.map(remoteParticipant =>
                                            <RemoteParticipantCard key={`${utils.getIdentifierText(remoteParticipant.identifier)}`} remoteParticipant={remoteParticipant} call={this.call} />
                                        )
                                    }
                                </ul>
                            </div>
                        </div>
                    }
                    <div className={this.state.callState === 'Connected' ? `ms-Grid-col ms-sm12 ms-lg12 ms-xl12 ms-xxl9` : 'ms-Grid-col ms-sm12 ms-lg12 ms-xl12 ms-xxl12'}>
                        <div className="mb-2">
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
                                        <Icon iconName="Video" />
                                    }
                                    {
                                        !this.state.videoOn &&
                                        <Icon iconName="VideoOff" />
                                    }
                                </span>
                                <span className="in-call-button"
                                    title={`${this.state.micMuted ? 'Unmute' : 'Mute'} your microphone`}
                                    variant="secondary"
                                    onClick={() => this.handleMicOnOff()}>
                                    {
                                        this.state.micMuted &&
                                        <Icon iconName="MicOff2" />
                                    }
                                    {
                                        !this.state.micMuted &&
                                        <Icon iconName="Microphone" />
                                    }
                                </span>
                                <span className="in-call-button"
                                    title={`${this.state.incomingAudioMuted ? 'Unmute' : 'Mute'} incoming audio`}
                                    variant="secondary"
                                    onClick={() => this.handleIncomingAudioOnOff()}>
                                    {
                                        this.state.incomingAudioMuted &&
                                        <Icon iconName="VolumeDisabled" />
                                    }
                                    {
                                        !this.state.incomingAudioMuted &&
                                        <Icon iconName="Volume2" />
                                    }
                                </span>
                                <span className="in-call-button"
                                    title={`${this.state.screenShareOn ? 'Stop' : 'Start'} sharing your screen`}
                                    variant="secondary"
                                    onClick={() => this.handleScreenSharingOnOff()}>
                                    {
                                        !this.state.screenShareOn &&
                                        <Icon iconName="TVMonitor" />
                                    }
                                    {
                                        this.state.screenShareOn &&
                                        <Icon iconName="CircleStop" />
                                    }
                                </span>
                                {
                                    (this.state.callState === 'Connected' ||
                                    this.state.callState === 'LocalHold' ||
                                    this.state.callState === 'RemoteHold') &&
                                    <span className="in-call-button"
                                        title={`${this.state.callState === 'LocalHold' ? 'Unhold' : 'Hold'} call`}
                                        variant="secondary"
                                        onClick={() => this.handleHoldUnhold()}>
                                        {
                                            (this.state.callState === 'LocalHold') &&
                                            <Icon iconName="Pause" />
                                        }
                                        {
                                            (this.state.callState === 'Connected' || this.state.callState === 'RemoteHold') &&
                                            <Icon iconName="Play" />
                                        }
                                    </span>
                                }
                                <span className="in-call-button"
                                    title="Settings"
                                    variant="secondary"
                                    onClick={() => this.setState({ showSettings: true })}>
                                    <Icon iconName="Settings" />
                                </span>
                                <span className="in-call-button"
                                    onClick={() => this.call.hangUp()}>
                                    <Icon iconName="DeclineCall" />
                                </span>
                                <span className="in-call-button"
                                    title={`${this.state.outgoingAudioMediaAccessActive ? 'Clear audio effect' : 'Apply outgoing audio effect'} to call`}
                                    variant="secondary"
                                    onClick={() => this.handleOutgoingAudioEffect()}>
                                    {
                                        this.state.outgoingAudioMediaAccessActive &&
                                        <Icon iconName="PlugConnected" />
                                    }
                                    {
                                        !this.state.outgoingAudioMediaAccessActive &&
                                        <Icon iconName="PlugDisconnected" />
                                    }
                                </span>
                                <span className="in-call-button"
                                    title={`${this.state.logMediaStats? 'Stop' : 'Start'} logging MediaStats`}
                                    variant="secondary"
                                    onClick={() => this.handleMediaStatsLogState()}>
                                    {
                                        this.state.logMediaStats &&
                                        <Icon iconName="NumberedList" />
                                    }
                                    {
                                        !this.state.logMediaStats &&
                                        <Icon iconName="NumberedListText" />
                                    }
                                </span>
                                <Panel type={PanelType.medium}
                                    isLightDismiss
                                    isOpen={this.state.showSettings}
                                    onDismiss={() => this.setState({ showSettings: false })}
                                    closeButtonAriaLabel="Close"
                                    headerText="Settings">
                                    <div className="pl-2 mt-3">
                                        <h3>Video settings</h3>
                                        <div className="pl-2">
                                            <span>
                                                <h4>Camera preview</h4>
                                            </span>
                                            <DefaultButton onClick={() => this.setState({ showLocalVideo: !this.state.showLocalVideo })}>
                                                Show/Hide
                                            </DefaultButton>
                                            {
                                                this.state.callState === 'Connected' &&
                                                <Dropdown
                                                    selectedKey={this.state.selectedCameraDeviceId}
                                                    onChange={this.cameraDeviceSelectionChanged}
                                                    label={'Camera'}
                                                    options={this.state.cameraDeviceOptions}
                                                    placeHolder={this.state.cameraDeviceOptions.length === 0 ? 'No camera devices found' : this.state.selectedCameraDeviceId }
                                                    styles={{ dropdown: { width: 400 } }}
                                                />
                                            }
                                        </div>
                                    </div>
                                    <div className="pl-2 mt-4">
                                        <h3>Sound Settings</h3>
                                        <div className="pl-2">
                                            {
                                                this.state.callState === 'Connected' &&
                                                <Dropdown
                                                    selectedKey={this.state.selectedSpeakerDeviceId}
                                                    onChange={this.speakerDeviceSelectionChanged}
                                                    options={this.state.speakerDeviceOptions}
                                                    label={'Speaker'}
                                                    placeHolder={this.state.speakerDeviceOptions.length === 0 ? 'No speaker devices found' : this.state.selectedSpeakerDeviceId}
                                                    styles={{ dropdown: { width: 400 } }}
                                                />
                                            }
                                            {
                                                this.state.callState === 'Connected' &&
                                                <Dropdown
                                                    selectedKey={this.state.selectedMicrophoneDeviceId}
                                                    onChange={this.microphoneDeviceSelectionChanged}
                                                    options={this.state.microphoneDeviceOptions}
                                                    label={'Microphone'}
                                                    placeHolder={this.state.microphoneDeviceOptions.length === 0 ? 'No microphone devices found' : this.state.selectedMicrophoneDeviceId}
                                                    styles={{ dropdown: { width: 400 } }}
                                                />
                                            }
                                            <div>
                                            {
                                                (this.state.callState === 'Connected') && !this.state.micMuted && !this.state.incomingAudioMuted &&
                                                <h3>Volume Visualizer</h3>
                                            }
                                            {
                                                (this.state.callState === 'Connected') && !this.state.micMuted && !this.state.incomingAudioMuted &&
                                                <VolumeVisualizer call={this.call} deviceManager={this.deviceManager} remoteVolumeLevel={this.state.remoteVolumeLevel} />
                                            }
                                            </div>
                                        </div>
                                    </div>
                                </Panel>
                            </div>
                        </div>
                        <div className="ms-Grid-row text-center">
                            {
                                this.state.videoOn &&
                                <div className='ms-Grid-row video-features-container'>
                                    <div className='ms-Grid-col ms-sm12 ms-lg6 video-feature-sample'>
                                        <Label className='title'>Raw Video access</Label>
                                        <CustomVideoEffects call={this.call} deviceManager={this.deviceManager} />
                                    </div>
                                    <div className='ms-Grid-col ms-sm12 ms-lg6 video-feature-sample'>
                                        <Label className='title'>Video effects</Label>
                                        <VideoEffectsContainer call={ this.call } />
                                    </div>
                                </div>
                            }
                        </div>
                        <div>
                            {
                                this.state.showLocalVideo &&
                                <div className="mb-3">
                                    <LocalVideoPreviewCard selectedCameraDeviceId={this.state.selectedCameraDeviceId} deviceManager={this.deviceManager} />
                                </div>
                            }
                        </div>
                        {
                            <div className="video-grid-row">
                                {
                                    (this.state.callState === 'Connected' ||
                                    this.state.callState === 'LocalHold' ||
                                    this.state.callState === 'RemoteHold') &&
                                    this.state.allRemoteParticipantStreams.map(v =>
                                        <StreamRenderer
                                                        key={`${utils.getIdentifierText(v.participant.identifier)}-${v.stream.mediaStreamType}-${v.stream.id}`}
                                                        ref ={v.streamRendererComponentRef}
                                                        stream={v.stream}
                                                        remoteParticipant={v.participant}
                                                        dominantSpeakerMode={this.state.dominantSpeakerMode}
                                                        dominantRemoteParticipant={this.state.dominantRemoteParticipant}
                                                        call={this.call}
                                                        maximumNumberOfRenderers={this.maximumNumberOfRenderers}
                                                        updateStreamList={() => this.updateStreamList()}
                                                        showMediaStats={this.state.logMediaStats}
                                                        />
                                    )
                                }
                            </div>
                        }
                    </div>
                </div>
            </div>
        );
    }
}
