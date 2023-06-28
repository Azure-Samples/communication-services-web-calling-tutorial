import React from "react";
import { MessageBar, MessageBarType, DefaultButton } from 'office-ui-fabric-react'
import { Toggle } from '@fluentui/react/lib/Toggle';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import { FunctionalStreamRenderer as StreamRenderer } from "./FunctionalStreamRenderer";
import AddParticipantPopover from "./AddParticipantPopover";
import RemoteParticipantCard from "./RemoteParticipantCard";
import { Panel, PanelType } from 'office-ui-fabric-react/lib/Panel';
import { Icon } from '@fluentui/react/lib/Icon';
import LocalVideoPreviewCard from './LocalVideoPreviewCard';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { LocalVideoStream, Features, LocalAudioStream, VideoStreamRenderer } from '@azure/communication-calling';
import { utils } from '../Utils/Utils';
import CustomVideoEffects from "./RawVideoAccess/CustomVideoEffects";
import VideoEffectsContainer from './VideoEffects/VideoEffectsContainer';
import { AzureLogger } from '@azure/logger';
import VolumeVisualizer from "./VolumeVisualizer";
import CurrentCallInformation from "./CurrentCallInformation";
import DataChannelCard from './DataChannelCard';
import CallCaption from "./CallCaption";
import { ParticipantMenuOptions } from './ParticipantMenuOptions';
export default class CallCard extends React.Component {
    constructor(props) {
        super(props);
        this.callFinishConnectingResolve = undefined;
        this.call = props.call;
        this.localVideoStream = this.call.localVideoStreams.find(lvs => {
            return lvs.mediaStreamType === 'Video' || lvs.mediaStreamType === 'RawMedia'
        });
        this.localScreenSharingStream = undefined;
        this.deviceManager = props.deviceManager;
        this.remoteVolumeLevelSubscription = undefined;
        this.handleRemoteVolumeSubscription = undefined;
        this.streamIsAvailableListeners = new Map();
        this.videoStreamsUpdatedListeners = new Map();
        this.identifier = props.identityMri;
        this.spotlightFeature = this.call.feature(Features.Spotlight);
        this.raiseHandFeature = this.call.feature(Features.RaiseHand);
        this.identifier = props.identityMri;
        this.isTeamsUser = props.isTeamsUser;
        this.dummyStreamTimeout = undefined;
        this.state = {
            ovc: 4,
            callState: this.call.state,
            callId: this.call.id,
            remoteParticipants: [],
            allRemoteParticipantStreams: [],
            remoteScreenShareStream: undefined,
            videoOn: this.call.isLocalVideoStarted,
            screenSharingOn: this.call.isScreenSharingOn,
            micMuted: this.call.isMuted,
            incomingAudioMuted: false,
            onHold: this.call.state === 'LocalHold' || this.call.state === 'RemoteHold',
            outgoingAudioMediaAccessActive: false,
            cameraDeviceOptions: props.cameraDeviceOptions ? props.cameraDeviceOptions : [],
            speakerDeviceOptions: props.speakerDeviceOptions ? props.speakerDeviceOptions : [],
            microphoneDeviceOptions: props.microphoneDeviceOptions ? props.microphoneDeviceOptions : [],
            selectedCameraDeviceId: props.selectedCameraDeviceId,
            selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id,
            selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id,
            showSettings: false,
            // StartWithNormal or StartWithDummy
            localScreenSharingMode: undefined,
            callMessage: undefined,
            dominantSpeakerMode: false,
            captionOn: false,
            dominantRemoteParticipant: undefined,
            logMediaStats: false,
            sentResolution: '',
            remoteVolumeIndicator: undefined,
            remoteVolumeLevel: undefined,
            mediaCollector: undefined,
            isSpotlighted: false,
            isHandRaised: false,
            showParticipantsCard: true
        };
        this.selectedRemoteParticipants = new Set();
        this.dataChannelRef = React.createRef();
    }

    componentWillUnmount() {
        this.call.off('stateChanged', () => { });
        this.deviceManager.off('videoDevicesUpdated', () => { });
        this.deviceManager.off('audioDevicesUpdated', () => { });
        this.deviceManager.off('selectedSpeakerChanged', () => { });
        this.deviceManager.off('selectedMicrophoneChanged', () => { });
        this.call.off('localVideoStreamsUpdated', () => { });
        this.call.off('idChanged', () => { });
        this.call.off('isMutedChanged', () => { });
        this.call.off('isIncomingAudioMutedChanged', () => { });
        this.call.off('isScreenSharingOnChanged', () => { });
        this.call.off('remoteParticipantsUpdated', () => { });
        this.state.mediaCollector?.off('sampleReported', () => { });
        this.state.mediaCollector?.off('summaryReported', () => { });
        this.call.feature(Features.DominantSpeakers).off('dominantSpeakersChanged', () => { });
        this.call.feature(Features.Spotlight).off('spotlightChanged', this.spotlightStateChangedHandler);
        this.call.feature(Features.RaiseHand).off('raisedHandEvent', this.raiseHandChangedHandler);
        this.call.feature(Features.RaiseHand).off('loweredHandEvent', this.raiseHandChangedHandler);
    }

    componentDidMount() {
        if (this.call) {
            this.deviceManager.on('videoDevicesUpdated', async e => {
                e.added.forEach(addedCameraDevice => {
                    const addedCameraDeviceOption = { key: addedCameraDevice.id, text: addedCameraDevice.name };
                    this.setState(prevState => ({
                        ...prevState,
                        cameraDeviceOptions: [...prevState.cameraDeviceOptions, addedCameraDeviceOption]
                    }));
                });

                e.removed.forEach(async removedCameraDevice => {
                    // If the selected camera is removed, select a new camera.
                    // Note: When the selected camera is removed, the calling sdk automatically turns video off.
                    this.setState(prevState => ({
                        ...prevState,
                        cameraDeviceOptions: prevState.cameraDeviceOptions.filter(option => { return option.key !== removedCameraDevice.id })
                    }), () => {
                        if (removedCameraDevice.id === this.state.selectedCameraDeviceId) {
                            this.setState({ selectedCameraDeviceId: this.state.cameraDeviceOptions[0]?.key });
                        }
                    });
                });
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

            this.call.on('isLocalVideoStartedChanged', () => {
                this.setState({ videoOn: this.call.isLocalVideoStarted });
            });

            this.call.on('isScreenSharingOnChanged', () => {
                this.setState({ screenSharingOn: this.call.isScreenSharingOn });
                if (!this.call.isScreenSharing) {
                    if (this.state.localScreenSharingMode == 'StartWithDummy') {
                        clearTimeout(this.dummyStreamTimeout);
                        this.dummyStreamTimeout = undefined;
                    }
                    this.setState({ localScreenSharingMode: undefined });
                }
            });

            const handleParticipant = (participant) => {
                if (!this.state.remoteParticipants.find((p) => { return p === participant })) {
                    this.setState(prevState => ({
                        ...prevState,
                        remoteParticipants: [...prevState.remoteParticipants, participant]
                    }), () => {
                        const handleVideoStreamAdded = (vs) => {
                            if (vs.isAvailable) this.updateListOfParticipantsToRender('streamIsAvailable');
                            const isAvailableChangedListener = () => {
                                this.updateListOfParticipantsToRender('streamIsAvailableChanged');
                            }
                            this.streamIsAvailableListeners.set(vs, isAvailableChangedListener);
                            vs.on('isAvailableChanged', isAvailableChangedListener)
                        }
        
                        participant.videoStreams.forEach(handleVideoStreamAdded);
        
                        const videoStreamsUpdatedListener = (e) => {
                            e.added.forEach(handleVideoStreamAdded);
                            e.removed.forEach((vs) => {
                                this.updateListOfParticipantsToRender('videoStreamsRemoved');
                                const streamIsAvailableListener = this.streamIsAvailableListeners.get(vs);
                                if (streamIsAvailableListener) {
                                    vs.off('isAvailableChanged', streamIsAvailableListener);
                                    this.streamIsAvailableListeners.delete(vs);
                                }
                            }); 
                        }
                        this.videoStreamsUpdatedListeners.set(participant, videoStreamsUpdatedListener);
                        participant.on('videoStreamsUpdated', videoStreamsUpdatedListener);
                    });
                }
            }

            this.call.remoteParticipants.forEach(rp => handleParticipant(rp));

            this.call.on('remoteParticipantsUpdated', e => {
                console.log(`Call=${this.call.callId}, remoteParticipantsUpdated, added=${e.added}, removed=${e.removed}`);
                e.added.forEach(participant => {
                    console.log('participantAdded', participant);
                    handleParticipant(participant)
                });
                e.removed.forEach(participant => {
                    console.log('participantRemoved', participant);
                    if (participant.callEndReason) {
                        this.setState(prevState => ({
                            ...prevState,
                            callMessage: `${prevState.callMessage ? prevState.callMessage + `\n` : ``}
                                        Remote participant ${utils.getIdentifierText(participant.identifier)} disconnected: code: ${participant.callEndReason.code}, subCode: ${participant.callEndReason.subCode}.`
                        }));
                    }
                    this.setState({ remoteParticipants: this.state.remoteParticipants.filter(p => { return p !== participant }) });
                    this.updateListOfParticipantsToRender('participantRemoved');
                    const videoStreamUpdatedListener = this.videoStreamsUpdatedListeners.get(participant);
                    if (videoStreamUpdatedListener) {
                        participant.off('videoStreamsUpdated', videoStreamUpdatedListener);
                        this.videoStreamsUpdatedListeners.delete(participant);
                    }
                    participant.videoStreams.forEach(vs => {
                        const streamIsAvailableListener = this.streamIsAvailableListeners.get(vs);
                        if (streamIsAvailableListener) {
                            vs.off('isAvailableChanged', streamIsAvailableListener);
                            this.streamIsAvailableListeners.delete(vs);
                        }
                    });
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
                    if (this.state.dominantSpeakerMode) {

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
                                    if (!streamTuple.streamRendererComponentRef.current.getRenderer()) {
                                        await streamTuple.streamRendererComponentRef.current.createRenderer();
                                    };
                                }
                            }

                            const previousDominantSpeaker = this.state.dominantRemoteParticipant;
                            this.setState({ dominantRemoteParticipant: newDominantRemoteParticipant });

                            if (previousDominantSpeaker) {
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
            if (dominantSpeakerIdentifier) {
                this.setState({ dominantRemoteParticipant: utils.getRemoteParticipantObjFromIdentifier(dominantSpeakerIdentifier) })
            }
            this.call.feature(Features.DominantSpeakers).on('dominantSpeakersChanged', dominantSpeakersChangedHandler);

            const capabilitiesFeature = this.call.feature(Features.Capabilities);
            const capabilities = this.call.feature(Features.Capabilities).capabilities;
            capabilitiesFeature.on('capabilitiesChanged', () => {
                const updatedCapabilities = capabilitiesFeature.capabilities;
            });

            const ovcFeature = this.call.feature(Features.OptimalVideoCount);
            const ovcChangedHandler = () => {
                if (this.state.ovc !== ovcFeature.optimalVideoCount) {
                    this.setState({ ovc: ovcFeature.optimalVideoCount });
                    this.updateListOfParticipantsToRender('optimalVideoCountChanged');
                }
            }
            ovcFeature?.on('optimalVideoCountChanged', () => ovcChangedHandler());
            this.spotlightFeature.on("spotlightChanged", this.spotlightStateChangedHandler);
            this.raiseHandFeature.on("loweredHandEvent", this.raiseHandChangedHandler);
            this.raiseHandFeature.on("raisedHandEvent", this.raiseHandChangedHandler);
        }
    }
    
    updateListOfParticipantsToRender(reason) {

        const ovcFeature = this.call.feature(Features.OptimalVideoCount);
        const optimalVideoCount = ovcFeature.optimalVideoCount;
        console.log(`updateListOfParticipantsToRender because ${reason}, ovc is ${optimalVideoCount}`);
        console.log(`updateListOfParticipantsToRender currently rendering ${this.state.allRemoteParticipantStreams.length} streams`);
        console.log(`updateListOfParticipantsToRender checking participants that were removed`);
        let streamsToKeep = this.state.allRemoteParticipantStreams.filter(streamTuple => {
            return this.state.remoteParticipants.find(participant => participant.videoStreams.find(stream => stream === streamTuple.stream && stream.isAvailable));
        });

        let screenShareStream = this.state.remoteScreenShareStream;
        console.log(`updateListOfParticipantsToRender current screen share ${!!screenShareStream}`);
        screenShareStream = this.state.remoteParticipants
            .filter(participant => participant.videoStreams.find(stream => stream.mediaStreamType === 'ScreenSharing' && stream.isAvailable))
            .map(participant => {
            return { 
                stream: participant.videoStreams.filter(stream => stream.mediaStreamType === 'ScreenSharing')[0],
                participant,
                streamRendererComponentRef: React.createRef() }
            })[0];

        console.log(`updateListOfParticipantsToRender streams to keep=${streamsToKeep.length}, including screen share ${!!screenShareStream}`);

        if (streamsToKeep.length > optimalVideoCount) {
            console.log('updateListOfParticipantsToRender reducing number of videos to ovc=', optimalVideoCount);
            streamsToKeep = streamsToKeep.slice(0, optimalVideoCount);
        }

        // we can add more streams if we have less than optimalVideoCount
        if (streamsToKeep.length < optimalVideoCount) {
            console.log(`stack is capable of rendering ${optimalVideoCount - streamsToKeep.length} more streams, adding...`);
            let streamsToAdd = [];
            this.state.remoteParticipants.forEach(participant => {
                const newStreams = participant.videoStreams
                    .flat()
                    .filter(stream => stream.mediaStreamType === 'Video' && stream.isAvailable)
                    .filter(stream => !streamsToKeep.find(streamTuple => streamTuple.stream === stream))
                    .map(stream => { return { stream, participant, streamRendererComponentRef: React.createRef() } });
                streamsToAdd.push(...newStreams);
            });
            streamsToAdd = streamsToAdd.slice(0, optimalVideoCount - streamsToKeep.length);
            console.log(`updateListOfParticipantsToRender identified ${streamsToAdd.length} streams to add`);
            streamsToKeep = streamsToKeep.concat(streamsToAdd.filter(e => !!e));
        }
        console.log(`updateListOfParticipantsToRender final number of streams to render ${streamsToKeep.length}}`);
        this.setState(prevState => ({
            ...prevState,
            remoteScreenShareStream: screenShareStream,
            allRemoteParticipantStreams: streamsToKeep
        }));
    }

    spotlightStateChangedHandler = (event) => {
        this.setState({isSpotlighted: utils.isParticipantSpotlighted(
            this.identifier, this.spotlightFeature.getSpotlightedParticipants())})
    }

    raiseHandChangedHandler = (event) => {
        this.setState({isHandRaised: utils.isParticipantHandRaised(this.identifier, this.raiseHandFeature.getRaisedHands())})
    }

    async handleVideoOnOff() {
        try {
            if (!this.state.videoOn) {
                const cameras = await this.deviceManager.getCameras();
                const cameraDeviceInfo = cameras.find(cameraDeviceInfo => {
                    return cameraDeviceInfo.id === this.state.selectedCameraDeviceId
                });
                this.localVideoStream = new LocalVideoStream(cameraDeviceInfo);
            } 


            if (this.call.state === 'None' ||
                this.call.state === 'Connecting' ||
                this.call.state === 'Incoming') {
                if (this.state.videoOn) {
                    this.setState({ videoOn: false });
                } else {
                    this.setState({ videoOn: true })
                }
                await this.watchForCallFinishConnecting();
                if (this.state.videoOn) {
                    await this.call.startVideo(this.localVideoStream);
                } else {
                    await this.call.stopVideo(this.localVideoStream);
                }
            } else {
                if (!this.state.videoOn) {
                    await this.call.startVideo(this.localVideoStream);
                } else {
                    await this.call.stopVideo(this.localVideoStream);
                }
            }
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

    async handleRaiseHand() {
        try {
            this.state.isHandRaised ?
                this.raiseHandFeature.lowerHand():
                this.raiseHandFeature.raiseHand();
        } catch(e) {
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

    async toggleParticipantsCard() {
        this.setState(prevState => ({
            ...prevState,
            showParticipantsCard: !prevState.showParticipantsCard
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
                await this.call.stopScreenSharing();
                this.setState({ localScreenSharingMode: undefined });
            } else {
                await this.call.startScreenSharing();
                this.localScreenSharingStream = this.call.localVideoStreams.find(ss => {
                    return ss.mediaStreamType === 'ScreenSharing'
                });
                this.setState({ localScreenSharingMode: 'StartWithNormal'});
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleRawScreenSharingOnOff() {
        try {
            if (this.call.isScreenSharingOn) {
                await this.call.stopScreenSharing();
                clearImmediate(this.dummyStreamTimeout);
                this.dummyStreamTimeout = undefined;
                this.setState({ localScreenSharingMode: undefined });
            } else {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', {willReadFrequently: true});
                canvas.width = 1280;
                canvas.height = 720;
                ctx.fillStyle = 'blue';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
        
                const colors = ['red', 'yellow', 'green'];
                const FPS = 30;
                const createShapes = function () {
                    try {
                        let begin = Date.now();
                        // start processing.
                        if (ctx) {
                            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                            const x = Math.floor(Math.random() * canvas.width);
                            const y = Math.floor(Math.random() * canvas.height);
                            const size = 100;
                            ctx.fillRect(x, y, size, size);
                        }            
                        // schedule the next one.
                        let delay = Math.abs(1000/FPS - (Date.now() - begin));
                        this.dummyStreamTimeout = setTimeout(createShapes, delay);
                    } catch (err) {
                        console.error(err);
                    }
                }.bind(this);
        
                // schedule the first one.
                this.dummyStreamTimeout = setTimeout(createShapes, 0);
                const dummyStream = canvas.captureStream(FPS);
                this.localScreenSharingStream = new LocalVideoStream(dummyStream);
                await this.call.startScreenSharing(this.localScreenSharingStream);
                this.setState({ localScreenSharingMode: 'StartWithDummy'});
            }
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
                    if (streamTuple.stream.isAvailable && !streamTuple.streamRendererComponentRef.current.getRenderer()) {
                        await streamTuple.streamRendererComponentRef.current.createRenderer();
                        streamTuple.streamRendererComponentRef.current.attachRenderer();
                    }
                }
            } else {
                // Turn on dominant speaker mode
                this.setState({ dominantSpeakerMode: true });
                // Dispose of all remote participants's stream renderers
                const dominantSpeakerIdentifier = this.call.feature(Features.DominantSpeakers).dominantSpeakers.speakersList[0];
                if (!dominantSpeakerIdentifier) {
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
                    if (v.participant !== dominantRemoteParticipant) {
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
        this.setState({ selectedCameraDeviceId: cameraDeviceInfo.id });
        if (this.localVideoStream.mediaStreamType === 'RawMedia' && this.state.videoOn) {
            this.localVideoStream?.switchSource(cameraDeviceInfo);
             await this.call.stopVideo(this.localVideoStream);
             await this.call.startVideo(this.localVideoStream);
        } else {
            this.localVideoStream?.switchSource(cameraDeviceInfo);
        }
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

    getParticipantMenuCallBacks() {
        return {
            startSpotlight: async (identifier) => {
                try {
                    await this.spotlightFeature.startSpotlight([identifier]);
                } catch(error) {
                    console.error(error)
                }
            },
            stopSpotlight: async (identifier) => {
                try {
                    await this.spotlightFeature.stopSpotlight([identifier]);
                } catch(error) {
                    console.error(error)
                }
            },
            stopAllSpotlight: async () => {
                try {
                    await this.spotlightFeature.stopAllSpotlight();
                } catch(error) {
                    console.error(error)
                }
            },
            lowerAllHands: async () => {
                try {
                    await this.raiseHandFeature.lowerAllHands();
                } catch(error) {
                    console.error(error)
                }
            },
        }
    }

    getMenuItems() {
        let menuCallBacks = this.getParticipantMenuCallBacks();
        let menuItems = [
            this.spotlightFeature.getSpotlightedParticipants().length && {
                key: 'Stop All Spotlight',
                iconProps: { iconName: 'Focus'},
                text: 'Stop All Spotlight',
                onClick: (e) => menuCallBacks.stopAllSpotlight(e)
            }, 
            this.raiseHandFeature.getRaisedHands().length && {
                key: 'Lower All Hands',
                iconProps: { iconName: 'HandsFree'},
                text: 'Lower All Hands',
                onClick: (e) => menuCallBacks.lowerAllHands(e)
            },
        ]
        return menuItems.filter(item => item != 0)
    }

    remoteParticipantSelectionChanged(identifier, isChecked) {
        if (isChecked) {
            this.selectedRemoteParticipants.add(identifier);
        } else {
            this.selectedRemoteParticipants.delete(identifier);
        }
        const selectedParticipants = [];
        const allParticipants = new Set(this.call.remoteParticipants.map(rp => rp.identifier));
        this.selectedRemoteParticipants.forEach(identifier => {
            if (allParticipants.has(identifier)) {
                selectedParticipants.push(identifier);
            }
        });
        this.dataChannelRef.current.setParticipants(selectedParticipants);
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
                        {
                            this.state.callState !== 'Connected' &&
                            <div>
                                <div className="inline-block ringing-loader mr-2"></div>
                                <h2 className="inline-block">{this.state.callState !== 'Connected' ? `${this.state.callState}...` : `Connected`}</h2>
                            </div>
                        }
                    </div>
                    {
                        this.call &&
                        <CurrentCallInformation sentResolution={this.state.sentResolution} call={this.call} />
                    }
                </div>
                <div className="video-grid-row">
                    {
                        (this.state.callState === 'Connected' ||
                            this.state.callState === 'LocalHold' ||
                            this.state.callState === 'RemoteHold') &&
                        this.state.allRemoteParticipantStreams.map(v =>
                            <StreamRenderer
                                key={`${utils.getIdentifierText(v.participant.identifier)}-${v.stream.mediaStreamType}-${v.stream.id}`}
                                ref={v.streamRendererComponentRef}
                                stream={v.stream}
                                remoteParticipant={v.participant}
                                dominantSpeakerMode={this.state.dominantSpeakerMode}
                                dominantRemoteParticipant={this.state.dominantRemoteParticipant}
                                call={this.call}
                                showMediaStats={this.state.logMediaStats}
                            />
                        )
                    }
                    {
                        (
                            this.state.remoteScreenShareStream &&
                                <StreamRenderer
                                    key={`${utils.getIdentifierText(this.state.remoteScreenShareStream.participant.identifier)}-${this.state.remoteScreenShareStream.stream.mediaStreamType}-${this.state.remoteScreenShareStream.stream.id}`}
                                    ref={this.state.remoteScreenShareStream.streamRendererComponentRef}
                                    stream={this.state.remoteScreenShareStream.stream}
                                    remoteParticipant={this.state.remoteScreenShareStream.participant}
                                    dominantSpeakerMode={this.state.dominantSpeakerMode}
                                    dominantRemoteParticipant={this.state.dominantRemoteParticipant}
                                    call={this.call}
                                    showMediaStats={this.state.logMediaStats}
                                />
                        )
                    }
                </div>
                <div className="ms-Grid-row">
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
                            title={`${this.state.screenSharingOn && this.localScreenSharingStream?.mediaStreamType === 'ScreenSharing' ? 'Stop' : 'Start'} screen sharing a screen/tab/app`}
                            variant="secondary"
                            onClick={() => this.handleScreenSharingOnOff()}>
                            {
                                (
                                    !this.state.screenSharingOn ||
                                    (this.state.screenSharingOn && this.state.localScreenSharingMode !== 'StartWithNormal')
                                ) &&
                                <Icon iconName="TVMonitor" />
                            }
                            {
                                this.state.screenSharingOn && this.state.localScreenSharingMode === 'StartWithNormal' &&
                                <Icon iconName="CircleStop" />
                            }
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.screenSharingOn && this.localScreenSharingStream?.mediaStreamType === 'RawMedia' ? 'Stop' : 'Start'} screen sharing a dummy stream`}
                            variant="secondary"
                            onClick={() => this.handleRawScreenSharingOnOff()}>
                            {
                                (
                                    !this.state.screenSharingOn ||
                                    (this.state.screenSharingOn && this.state.localScreenSharingMode !== 'StartWithDummy')
                                ) &&
                                <Icon iconName="Tablet" />
                            }
                            {
                                this.state.screenSharingOn && this.state.localScreenSharingMode === 'StartWithDummy' &&
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
                            title={`${this.state.logMediaStats ? 'Stop' : 'Start'} logging MediaStats`}
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
                        <span className="in-call-button"
                            title={`${!this.state.showParticipantsCard ? `Show Participants and Caption Panel` : `Hide Participants and Caption Panel`}`}
                            variant="secondary"
                            onClick={() => this.toggleParticipantsCard()}>
                            {
                                this.state.showParticipantsCard &&
                                <Icon iconName="Hide3" />
                            }
                            {
                                !this.state.showParticipantsCard &&
                                <Icon iconName="People" />
                            }
                        </span>
                        <span className="in-call-button "
                            title={`${this.state.isHandRaised  ? 'LowerHand' : 'RaiseHand'}`}
                            variant="secondary"
                            onClick={() => this.handleRaiseHand()}>
                            <Icon iconName="HandsFree"  className={this.state.isHandRaised ? "callFeatureEnabled" : ``}/>
                        </span>
                        <ParticipantMenuOptions
                            id={this.identifier}
                            appendMenuitems={this.getMenuItems()}
                            menuOptionsHandler={this.getParticipantMenuCallBacks()}
                            menuOptionsState={{isSpotlighted: this.state.isSpotlighted}}
                            />

                        <Panel type={PanelType.medium}
                            isLightDismiss
                            isOpen={this.state.showSettings}
                            onDismiss={() => this.setState({ showSettings: false })}
                            closeButtonAriaLabel="Close"
                            headerText="Settings">
                            <div className="pl-2 mt-3">
                                <h3>Video settings</h3>
                                <div className="pl-2">
                                    {
                                        this.state.callState === 'Connected' &&
                                        <Dropdown
                                            selectedKey={this.state.selectedCameraDeviceId}
                                            onChange={this.cameraDeviceSelectionChanged}
                                            label={'Camera'}
                                            options={this.state.cameraDeviceOptions}
                                            placeHolder={this.state.cameraDeviceOptions.length === 0 ? 'No camera devices found' : this.state.selectedCameraDeviceId}
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
                {
                    this.state.videoOn &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Local video preview</h3>
                        </div>
                        <div className="ms-Grid-row">
                            <div className="ms-Grid-col ms-sm12 ms-md4 ms-lg4">
                                <LocalVideoPreviewCard
                                    stream={this.localVideoStream}/>
                            </div>
                            <div className='ms-Grid-col ms-sm12 ms-md2 md-lg2'>
                                <h4>Raw Video access</h4>
                                <CustomVideoEffects
                                    stream={this.localVideoStream}
                                    buttons={{
                                        add: {
                                            label: "Set B/W effect",
                                            disabled: false
                                        },
                                        sendDummy: {
                                            label: "Set dummy effects", 
                                            disabled: false
                                        }
                                    }}
                                    isLocal={true}/>
                            </div>
                            <div className='ms-Grid-col ms-sm12 ms-md5 md-lg6'>
                                <VideoEffectsContainer call={this.call} />
                            </div>
                        </div>
                    </div>
                }
                {   this.state.localScreenSharingMode &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Local screen sharing preview</h3>
                        </div>
                        <div className="ms-Grid-row">
                            {
                                <div className="ms-Grid-col ms-sm12 ms-md6 ms-lg6">
                                    <LocalVideoPreviewCard
                                        stream={this.localScreenSharingStream}/>
                                </div>
                            }
                            <div className={'ms-Grid-col ms-sm12 ms-md2 md-lg2'}>
                                {
                                    this.state.localScreenSharingMode === 'StartWithNormal' &&
                                    <h4>Raw Screen Sharing access</h4>
                                }
                                {
                                    this.state.localScreenSharingMode === 'StartWithNormal' &&
                                    <CustomVideoEffects
                                        stream={this.localScreenSharingStream}
                                        buttons={{
                                            add: {
                                                label: "Set B/W effect",
                                                disabled: false
                                            },
                                            sendDummy: {
                                                label: "Set dummy effect", 
                                                disabled: false
                                            }
                                        }}
                                        isLocal={true}/>
                                }
                                {
                                    this.state.localScreenSharingMode === 'StartWithDummy' &&
                                    <div>
                                        <CustomVideoEffects
                                            className="mt-3"
                                            stream={this.localScreenSharingStream}/>
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                }
                {
                    this.state.callState === 'Connected' && this.state.showParticipantsCard &&
                    <div>
                        <div className="participants-panel mt-5 mb-3">
                            <Toggle label={
                                <div>
                                    Dominant Speaker mode{' '}
                                    <TooltipHost content={`Render the most dominant speaker's video streams only or render all remote participant video streams`}>
                                        <Icon iconName="Info" aria-label="Info tooltip" />
                                    </TooltipHost>
                                </div>
                            }
                                styles={{
                                    text: { color: '#edebe9' },
                                    label: { color: '#edebe9' },
                                }}
                                inlineLabel
                                onText="On"
                                offText="Off"
                                onChange={() => { this.toggleDominantSpeakerMode() }}
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
                                        <RemoteParticipantCard 
                                            key={`${utils.getIdentifierText(remoteParticipant.identifier)}`} 
                                            remoteParticipant={remoteParticipant} 
                                            call={this.call} 
                                            menuOptionsHandler={this.getParticipantMenuCallBacks()} 
                                            onSelectionChanged={(identifier, isChecked) => this.remoteParticipantSelectionChanged(identifier, isChecked)}
                                            />
                                    )
                                }
                            </ul>
                        </div>
                        <div className="participants-panel mt-1 mb-3">
                                <Toggle label={
                                        <div>
                                            Caption{' '}
                                            <TooltipHost content={`Turn on Captions to see the conversation script`}>
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
                                    defaultChecked={this.state.captionOn}
                                    onChange={() => { this.setState({ captionOn: !this.state.captionOn })}}
                                />
                                
                                {
                                    this.state.captionOn &&
                                    <CallCaption call={this.call} isTeamsUser={this.isTeamsUser}/>
                                }
                        </div>
                        <div className="ms-Grid-row">
                        {
                            this.state.callState === 'Connected' &&
                                <DataChannelCard call={this.call} ref={this.dataChannelRef} remoteParticipants={this.state.remoteParticipants} />
                        }
                        </div>
                    </div>

                }
            </div>
        );
    }
}
