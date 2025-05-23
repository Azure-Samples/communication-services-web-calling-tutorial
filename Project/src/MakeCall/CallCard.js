import React from "react";
import { MessageBar, MessageBarType } from '@fluentui/react'
import { StreamRenderer } from "./StreamRenderer";
import AddParticipantPopover from "./AddParticipantPopover";
import RemoteParticipantCard from "./RemoteParticipantCard";
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { Icon } from '@fluentui/react/lib/Icon';
import LocalVideoPreviewCard from './LocalVideoPreviewCard';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { LocalVideoStream, Features, LocalAudioStream } from '@azure/communication-calling';
import { utils } from '../Utils/Utils';
import CustomVideoEffects from "./RawVideoAccess/CustomVideoEffects";
import VideoEffectsContainer from './VideoEffects/VideoEffectsContainer';
import AudioEffectsContainer from './AudioEffects/AudioEffectsContainer';
import { AzureLogger } from '@azure/logger';
import VolumeVisualizer from "./VolumeVisualizer";
import CurrentCallInformation from "./CurrentCallInformation";
import DataChannelCard from './DataChannelCard';
import CallCaption from "./CallCaption";
import Lobby from "./Lobby";
import { ParticipantMenuOptions } from './ParticipantMenuOptions';
import MediaConstraint from './MediaConstraint';
import RealTimeTextCard from "./RealTimeTextCard";

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
        this.capabilitiesFeature = this.call.feature(Features.Capabilities);
        this.capabilities = this.capabilitiesFeature.capabilities;
        this.isTeamsUser = props.isTeamsUser;
        if (Features.RealTimeText && !this.isTeamsUser) {
            this.realTimeTextFeature = this.call.feature(Features.RealTimeText);
        }
        this.dominantSpeakersFeature = this.call.feature(Features.DominantSpeakers);
        this.recordingFeature = this.call.feature(Features.Recording);
        this.transcriptionFeature = this.call.feature(Features.Transcription);
        this.lobby = this.call.lobby;
        if (Features.Reaction) {
            this.meetingReaction = this.call.feature(Features.Reaction);
        }
        if (Features.PPTLive) {
            this.pptLiveFeature = this.call.feature(Features.PPTLive);
            this.pptLiveHtml = React.createRef();
        }
        let meetingMediaAccess = undefined;
        let remoteParticipantsMediaAccess = undefined;
        let mediaAccessMap = undefined;
        if (Features.MediaAccess) {
            this.mediaAccessCallFeature = this.call.feature(Features.MediaAccess);
            meetingMediaAccess = this.call.feature(Features.MediaAccess).getMeetingMediaAccess();
            remoteParticipantsMediaAccess = this.call.feature(Features.MediaAccess).getAllOthersMediaAccess();
            mediaAccessMap = new Map();
            remoteParticipantsMediaAccess.forEach((mediaAccess) => {
                mediaAccessMap.set(mediaAccess.participant.rawId, mediaAccess);
            });
        }
        this.dummyStreamTimeout = undefined;
        this.state = {
            ovc: 4,
            callState: this.call.state,
            callId: this.call.id,
            remoteParticipants: [],
            allRemoteParticipantStreams: [],
            remoteScreenShareStream: undefined,
            canOnVideo: this.capabilities.turnVideoOn?.isPresent || this.capabilities.turnVideoOn?.reason === 'FeatureNotSupported',
            canUnMuteMic: this.capabilities.unmuteMic?.isPresent || this.capabilities.unmuteMic?.reason === 'FeatureNotSupported',
            canShareScreen: this.capabilities.shareScreen?.isPresent || this.capabilities.shareScreen?.reason === 'FeatureNotSupported',
            canRaiseHands: this.capabilities.raiseHand?.isPresent || this.capabilities.raiseHand?.reason === 'FeatureNotSupported',
            canSpotlight: this.capabilities.spotlightParticipant?.isPresent || this.capabilities.spotlightParticipant?.reason === 'FeatureNotSupported',
            canMuteOthers: this.capabilities.muteOthers?.isPresent || this.capabilities.muteOthers?.reason === 'FeatureNotSupported',
            canReact: this.capabilities.useReactions?.isPresent || this.capabilities.useReactions?.reason === 'FeatureNotSupported',
            canForbidOthersAudio: this.capabilities.forbidOthersAudio?.isPresent || this.capabilities.forbidOthersAudio?.reason === 'FeatureNotSupported',
            canForbidOthersVideo: this.capabilities.forbidOthersVideo?.isPresent || this.capabilities.forbidOthersVideo?.reason === 'FeatureNotSupported',
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
            isShowParticipants: false,
            showSettings: false,
            // StartWithNormal or StartWithDummy
            localScreenSharingMode: undefined,
            callMessage: undefined,
            dominantSpeakerMode: false,
            captionOn: false,
            realTimeTextOn: false,
            firstRealTimeTextReceivedorSent: false,
            showCanNotHideorCloseRealTimeTextBanner: false,
            dominantRemoteParticipant: undefined,
            logMediaStats: false,
            sentResolution: '',
            remoteVolumeIndicator: undefined,
            remoteVolumeLevel: undefined,
            mediaCollector: undefined,
            isSpotlighted: false,
            isHandRaised: false,
            dominantSpeakersListActive: false,
            dominantSpeakers:[],
            showDataChannel: false,
            showAddParticipantPanel: false,
            reactionRows:[],
            pptLiveActive: false,
            isRecordingActive: false,
            isTranscriptionActive: false,
            lobbyParticipantsCount: this.lobby?.participants.length,
            mediaAccessMap,
            meetingMediaAccess: {
                isAudioPermitted: meetingMediaAccess?.isAudioPermitted,
                isVideoPermitted: meetingMediaAccess?.isVideoPermitted,
            },
            isPinningActive: false,
            showPin2VideosList: false,
        };
        this.selectedRemoteParticipants = new Set();
        this.dataChannelRef = React.createRef();
        this.localVideoPreviewRef = React.createRef();
        this.localScreenSharingPreviewRef = React.createRef();
        this.isSetCallConstraints = this.call.setConstraints !== undefined;
    }

    setFirstRealTimeTextReceivedorSent = (state) => {
        this.setState({ firstRealTimeTextReceivedorSent: state });
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
        this.recordingFeature.off('isRecordingActiveChanged', this.isRecordingActiveChangedHandler);
        this.transcriptionFeature.off('isTranscriptionActiveChanged', this.isTranscriptionActiveChangedHandler);
        this.lobby?.off('lobbyParticipantsUpdated', () => { });
        if (Features.Reaction) {
            this.call.feature(Features.Reaction).off('reaction', this.reactionChangeHandler);
        }
        if (Features.PPTLive) {
            this.call.feature(Features.PPTLive).off('isActiveChanged', this.pptLiveChangedHandler);
        }
        this.dominantSpeakersFeature.off('dominantSpeakersChanged', this.dominantSpeakersChanged);
        if (Features.mediaAccess) {
            this.mediaAccessCallFeature.off('mediaAccessChanged', this.mediaAccessChangedHandler);
            this.mediaAccessCallFeature.off('meetingMediaAccessChanged', this.meetingMediaAccessChangedHandler);
        }
    }

    componentDidMount() {
        if (this.call) {
            this.deviceManager.on('videoDevicesUpdated', async e => {
                e.added.forEach(addedCameraDevice => {
                    const addedCameraDeviceOption = { key: addedCameraDevice.id, text: addedCameraDevice.name };
                    // If there were no cameras in the system and then a camera is plugged in / enabled, select it for use.
                    if (this.state.cameraDeviceOptions.length === 0 && !this.state.selectedCameraDeviceId) {
                        this.setState({ selectedCameraDeviceId: addedCameraDevice.id });
                    }
                    this.setState(prevState => ({
                        ...prevState,
                        cameraDeviceOptions: [...prevState.cameraDeviceOptions, addedCameraDeviceOption]
                    }));
                });

                e.removed.forEach(async removedCameraDevice => {
                    // If the selected camera is removed, select a new camera.
                    // If there are no other cameras, then just set this.state.selectedCameraDeviceId to undefined.
                    // When the selected camera is removed, the calling sdk automatically turns video off.
                    // User needs to manually turn video on again.
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

                if (this.call.state !== 'Disconnected') {
                    this.setState({ callState: this.call.state });
                }

                if (this.call.state === 'LocalHold' || this.call.state === 'RemoteHold') {
                    this.setState({ canRaiseHands: false });
                    this.setState({ canSpotlight: false });
                    this.setState({ canForbidOthersAudio: false });
                    this.setState({ canForbidOthersVideo: false });
                }
                if (this.call.state === 'Connected') {
                    this.setState({ canRaiseHands:  this.capabilities.raiseHand?.isPresent || this.capabilities.raiseHand?.reason === 'FeatureNotSupported' });
                    this.setState({ canSpotlight: this.capabilities.spotlightParticipant?.isPresent || this.capabilities.spotlightParticipant?.reason === 'FeatureNotSupported' });
                    this.setState({ canForbidOthersAudio: this.capabilities.forbidOthersAudio?.isPresent || this.capabilities.forbidOthersAudio?.reason === 'FeatureNotSupported' });
                    this.setState({ canForbidOthersVideo: this.capabilities.forbidOthersVideo?.isPresent || this.capabilities.forbidOthersVideo?.reason === 'FeatureNotSupported' });
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

            this.call.on('mutedByOthers', () => {
                const messageBarText = 'You have been muted by someone else';
                this.setState(prevState => ({
                    ...prevState,
                    callMessage: `${prevState.callMessage ? prevState.callMessage + `\n` : ``} ${messageBarText}.`
                }));
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
                    const videoStats = stats[v.stream.id];
                    const transportId = videoStats?.transportId;
                    const transportStats = transportId && data?.transports?.length ? data.transports.find(item => item.id === transportId) : undefined;
                    renderer?.updateReceiveStats(videoStats, transportStats);
                });
                if (this.state.logMediaStats) {
                    if (data.video.send.length > 0) {
                        let renderer = this.localVideoPreviewRef.current;
                        renderer?.updateSendStats(data.video.send[0]);
                    }
                    if (data.screenShare.send.length > 0) {
                        let renderer = this.localScreenSharingPreviewRef.current;
                        renderer?.updateSendStats(data.screenShare.send[0]);
                    }
                }
            });
            mediaCollector.on('summaryReported', (data) => {
                if (this.state.logMediaStats) {
                    AzureLogger.log(`${(new Date()).toISOString()} MediaStats summary: ${JSON.stringify(data)}`);
                }
            });

            const dominantSpeakersChangedHandler = async () => {
                try {
                    this.dominantSpeakersChanged();
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
                                    let view;
                                    if (!streamTuple.streamRendererComponentRef.current.getRenderer()) {
                                        view = await streamTuple.streamRendererComponentRef.current.createRenderer();
                                    };
                                    streamsToRender.push({streamTuple, view});
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
                            streamsToRender.forEach((x) => {
                                x.streamTuple.streamRendererComponentRef.current.attachRenderer(x.view);
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
            this.capabilitiesFeature.on('capabilitiesChanged', this.capabilitiesChangedHandler);
            this.dominantSpeakersFeature.on('dominantSeapkersChanged', this.dominantSpeakersChanged);
            this.meetingReaction?.on('reaction', this.reactionChangeHandler);
            this.pptLiveFeature?.on('isActiveChanged', this.pptLiveChangedHandler);
            this.recordingFeature.on('isRecordingActiveChanged', this.isRecordingActiveChangedHandler);
            this.transcriptionFeature.on('isTranscriptionActiveChanged', this.isTranscriptionActiveChangedHandler);
            this.lobby?.on('lobbyParticipantsUpdated', this.lobbyParticipantsUpdatedHandler);
            this.realTimeTextFeature?.on('realTimeTextReceived', this.realTimeTextReceivedHandler);
            if (Features.MediaAccess) {
                this.mediaAccessCallFeature.on('mediaAccessChanged', this.mediaAccessChangedHandler);
                this.mediaAccessCallFeature.on('meetingMediaAccessChanged', this.meetingMediaAccessChangedHandler);
            }
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
            streamsToKeep = streamsToKeep.concat(streamsToAdd.filter(stream => !!stream.participant));
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

    mediaAccessChangedHandler = (event) => {
        const mediaAccessMap = new Map();
        event.mediaAccesses.forEach((mediaAccess) => {
            mediaAccessMap.set(mediaAccess.participant.rawId, mediaAccess);
        });    
      
        this.setState({mediaAccessMap});
    }

    meetingMediaAccessChangedHandler = (event) => {
        if (event.meetingMediaAccess) {
            this.setState({meetingMediaAccess: {
                isAudioPermitted: event.meetingMediaAccess.isAudioPermitted,
                isVideoPermitted: event.meetingMediaAccess.isVideoPermitted,
            }});
        }
    }

    isRecordingActiveChangedHandler = (event) => {
        this.setState({ isRecordingActive: this.recordingFeature.isRecordingActive })
    }

    isTranscriptionActiveChangedHandler = (event) => {
        this.setState({ isTranscriptionActive: this.transcriptionFeature.isTranscriptionActive })
    }

    lobbyParticipantsUpdatedHandler = (event) => {
        console.log(`lobbyParticipantsUpdated, added=${event.added}, removed=${event.removed}`);
        this.state.lobbyParticipantsCount = this.lobby?.participants.length;
        if(event.added.length > 0) {
            event.added.forEach(participant => {
                console.log('lobbyParticipantAdded', participant);
            });
        }
        if(event.removed.length > 0) {
            event.removed.forEach(participant => {
                console.log('lobbyParticipantRemoved', participant);
            });
        }
    };

    raiseHandChangedHandler = (event) => {
        this.setState({isHandRaised: utils.isParticipantHandRaised(this.identifier, this.raiseHandFeature.getRaisedHands())})
    }

    reactionChangeHandler = (event) => {
        let displayName = 'Local Participant';
        let id = event.identifier;

        const idArray = id.split(':');
        id = idArray[idArray.length - 1];

        this.state.remoteParticipants.forEach(participant => {
            let pid = utils.getIdentifierText(participant.identifier);

            const pidArray = pid.split(':');
            pid = pidArray[pidArray.length - 1];
            console.log('Participant displayName - ' + participant.displayName?.trim());
            if(pid === id) {
                displayName = participant.displayName?.trim();
            }
        });

        if(displayName.length == 0) {
            displayName = 'Undefined';
        }

        const newEvent = {
            participantIdentifier: displayName,
            reaction: event.reactionMessage.reactionType,
            receiveTimestamp: new Date().toLocaleString(),
        }
        console.log(`reaction received - ${event.reactionMessage.name}`);

        this.setState({reactionRows: [...this.state.reactionRows, newEvent].slice(-100)});
    }

    pptLiveChangedHandler = async () => {
        const pptLiveActive = this.pptLiveFeature && this.pptLiveFeature.isActive;
        this.setState({ pptLiveActive });
    
        if (this.pptLiveHtml) {
            if (pptLiveActive) {
                this.pptLiveHtml.current.appendChild(this.pptLiveFeature.target);
                if (this.call.isScreenSharingOn) {
                    try {
                        await this.handleScreenSharingOnOff();
                    } catch {
                        console.log("Cannot stop screen sharing");
                    }
                }
            } else {
                this.pptLiveHtml.current.removeChild(this.pptLiveHtml.current.lastElementChild);
                if (!this.call.isScreenSharingOn && this.state.canShareScreen) {
                    try {
                        await this.handleScreenSharingOnOff();
                    } catch {
                        console.log("Cannot start screen sharing");
                    }
                }
            }
        }
    }

    capabilitiesChangedHandler = (capabilitiesChangeInfo) => {
        for (const [key, value] of Object.entries(capabilitiesChangeInfo.newValue)) {
            if(key === 'turnVideoOn' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState(prevState => ({ ...prevState, canOnVideo: true, callMessage: prevState.callMessage?.replace('Your camera has been disabled.','') })) : this.setState({ canOnVideo: false, callMessage: 'Your camera has been disabled.'  });
                continue;
            }
            if(key === 'unmuteMic' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState(prevState => ({...prevState, canUnMuteMic: true, callMessage: prevState.callMessage?.replace('Your mic has been disabled.','')  })) : this.setState({ canUnMuteMic: false, callMessage: 'Your mic has been disabled.' });
                continue;
            }
            if(key === 'shareScreen' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canShareScreen: true }) : this.setState({ canShareScreen: false });
                continue;
            }
            if(key === 'spotlightParticipant' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canSpotlight: true }) : this.setState({ canSpotlight: false });
                continue;
            }
            if(key === 'raiseHand' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canRaiseHands: true }) : this.setState({ canRaiseHands: false });
                continue;
            }
            if(key === 'muteOthers' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canMuteOthers: true }) : this.setState({ canMuteOthers: false });
                continue;
            }
            if(key === 'reaction' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canReact: true }) : this.setState({ canReact: false });
                continue;
            }
            if(key === 'forbidOthersAudio' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canForbidOthersAudio: true }) : this.setState({ canForbidOthersAudio: false });
                continue;
            }
            if(key === 'forbidOthersVideo' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canForbidOthersVideo: true }) : this.setState({ canForbidOthersVideo: false });
                continue;
            }
        }
        this.capabilities =  this.capabilitiesFeature.capabilities;
    }

    realTimeTextReceivedHandler = (rttData) => {
        this.setState({ realTimeTextOn: true });
        if (!this.state.firstRealTimeTextReceivedorSent) {
            this.setState({ firstRealTimeTextReceivedorSent: true });
        }
        if (rttData) {
    
            let mri = '';
            let displayName = '';
            switch (rttData.sender.identifier.kind) {
                case 'communicationUser': { mri = rttData.sender.identifier.communicationUserId; displayName = rttData.sender.displayName; break; }
                case 'microsoftTeamsUser': { mri = rttData.sender.identifier.microsoftTeamsUserId; displayName = rttData.sender.displayName; break; }
                case 'phoneNumber': { mri = rttData.sender.identifier.phoneNumber;  displayName = rttData.sender.displayName; break; }
            }

            let rttAreaContainer = document.getElementById('rttArea');

            const newClassName = `prefix${mri.replace(/:/g, '').replace(/-/g, '').replace(/\+/g, '')}`;
            const rttText = `${(rttData.receivedTimestamp).toUTCString()} ${displayName ?? mri} isTyping: `;

            let foundRTTContainer = rttAreaContainer.querySelector(`.${newClassName}[isNotFinal='true']`);

            if (!foundRTTContainer) {
                if (rttData.text.trim() === '') {
                    return
                }
                let rttContainer = document.createElement('div');
                rttContainer.setAttribute('isNotFinal', 'true');
                rttContainer.style['borderBottom'] = '1px solid';
                rttContainer.style['whiteSpace'] = 'pre-line';
                rttContainer.textContent = rttText + rttData.text;
                rttContainer.classList.add(newClassName);

                rttAreaContainer.appendChild(rttContainer);

                setTimeout(() => {
                    rttAreaContainer.removeChild(rttContainer);
                }, 40000);
            } else {
                if (rttData.text.trim() === '') {
                    rttAreaContainer.removeChild(foundRTTContainer);
                }
                if (rttData.resultType === 'Final') {
                    foundRTTContainer.setAttribute('isNotFinal', 'false');
                    foundRTTContainer.textContent = foundRTTContainer.textContent.replace(' isTyping', '');
                    if (rttData.isLocal) {
                        let rttTextField = document.getElementById('rttTextField');
                        rttTextField.value = null;
                    }
                } else {
                    foundRTTContainer.textContent = rttText + rttData.text;
                }
            }
        }
    }

    dominantSpeakersChanged = () => {
        const dominantSpeakersMris = this.dominantSpeakersFeature.dominantSpeakers.speakersList;
        const remoteParticipants = dominantSpeakersMris.map(dominantSpeakerMri => {
            const remoteParticipant = utils.getRemoteParticipantObjFromIdentifier(this.call, dominantSpeakerMri);
            return remoteParticipant;
        });

        this.setState({dominantSpeakers: remoteParticipants});
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
                if (this.state.videoOn && this.state.canOnVideo) {
                    await this.call.startVideo(this.localVideoStream);
                } else {
                    await this.call.stopVideo(this.localVideoStream);
                }
            } else {
                if (!this.state.videoOn && this.state.canOnVideo) {
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

    async handleMuteAllRemoteParticipants() {
        try {
            await this.call.muteAllRemoteParticipants();
        } catch (e) {
            console.error('Failed to mute all other participants.', e);
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

    async handleClickEmoji(index) {
        
        if(!this.state.canReact) {
            // 1:1 direct call with teams user is not supported.
            const messageBarText = 'Reaction capability is not allowed for this call type';
            console.error(messageBarText);
            this.setState({ callMessage: messageBarText })
            return ;
        }

        var reaction;
        switch(index) {
            case 0:
                reaction = 'like';
                break;
            case 1:
                reaction = 'heart';
                break;
            case 2:
                reaction = 'laugh';
                break;
            case 3:
                reaction = 'applause';
                break;
            case 4:
                reaction = 'surprised';
                break;
            default:
        }

        const reactionMessage = {
            reactionType: reaction
        };
        try {
            this.meetingReaction?.sendReaction(reactionMessage);
        } catch (error) {
            // Surface the error 
            console.error(error);
            const messageBarText = JSON.stringify(error);
            this.setState({ callMessage: messageBarText })
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

    async handleDominantSpeakersListActive() {
        this.setState(prevState => ({
            ...prevState,
            dominantSpeakersListActive: !prevState.dominantSpeakersListActive
        }));
    }

    async handleMediaStatsLogState() {
        this.setState(prevState => ({
            ...prevState,
            logMediaStats: !prevState.logMediaStats
        }), () => {
            if (!this.state.logMediaStats) {
                this.localVideoPreviewRef.current?.updateSendStats(undefined);
                this.localScreenSharingPreviewRef.current?.updateSendStats(undefined);
            }
        });
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
            } else if (this.state.canShareScreen) {
                await this.startScreenSharing();
            }
        } catch (e) {
            console.error(e);
        }
    }

    async startScreenSharing() {
        await this.call.startScreenSharing();
        this.localScreenSharingStream = this.call.localVideoStreams.find(ss => ss.mediaStreamType === 'ScreenSharing');
        this.setState({ localScreenSharingMode: 'StartWithNormal', pptLiveActive: false });
    }
    
    async handleRawScreenSharingOnOff() {
        try {
            if (this.call.isScreenSharingOn) {
                await this.call.stopScreenSharing();
                clearImmediate(this.dummyStreamTimeout);
                this.dummyStreamTimeout = undefined;
                this.setState({ localScreenSharingMode: undefined });
            } else {
                if (this.state.canShareScreen) {
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
            meetingAudioConferenceDetails:  async() => {
                let messageBarText = "call in (audio only) details: \n";
                try {
                    const audioConferencingfeature = this.call.feature(Features.TeamsMeetingAudioConferencing);
                    const audioConferenceDetails = await audioConferencingfeature.getTeamsMeetingAudioConferencingDetails();
                    console.log(`meetingAudioConferenceDetails: ${JSON.stringify(audioConferenceDetails)}`)
                    messageBarText += `Conference Id: ${audioConferenceDetails.phoneConferenceId}\n`;

                    audioConferenceDetails.phoneNumbers.map(phoneNumber =>
                    {
                        if (phoneNumber.tollPhoneNumber) {
                            messageBarText += `Toll Number: ${phoneNumber.tollPhoneNumber.phoneNumber}\n`;
                        }
                        if (phoneNumber.tollFreePhoneNumber) {
                            messageBarText += `Toll Free Number: ${phoneNumber.tollFreePhoneNumber.phoneNumber}\n`;
                        }
                        if (phoneNumber.countryName) {
                            messageBarText += `Country Name: ${phoneNumber.countryName}\n`;
                        }
                        if (phoneNumber.cityName) {
                            messageBarText += `City Name: ${phoneNumber.cityName}\n`;
                        }
                    });
                } catch (error) {
                    messageBarText += JSON.stringify(error);
                }
                console.log(`meetingAudioConferenceDetails MessageBarText = ${messageBarText}`)
                this.setState({ callMessage: messageBarText })
            },
            consentToBeingRecorded: async () => {
                try {
                    await this.recordingFeature.grantTeamsConsent();
                } catch(e) {
                    console.error(e);
                }
            },
            consentToBringTranscribed: async () => {
                try {
                    await this.transcriptionFeature.grantTeamsConsent();
                } catch(e) {
                    console.error(e);
                }
            },
            forbidAudio: async (identifier) => {
                try {
                    await this.mediaAccessCallFeature.forbidAudio([identifier]);
                } catch(e) {
                    console.error(e);
                }
            },
            permitAudio: async (identifier) => {
                try {
                    await this.mediaAccessCallFeature.permitAudio([identifier]);
                } catch(e) {
                    console.error(e);
                }
            },
            forbidVideo: async (identifier) => {
                try {
                    await this.mediaAccessCallFeature.forbidVideo([identifier]);
                } catch(e) {
                    console.error(e);
                }
            },
            permitVideo: async (identifier) => {
                try {
                    await this.mediaAccessCallFeature.permitVideo([identifier]);
                } catch(e) {
                    console.error(e);
                }
            },
            forbidOthersAudio: async () => {
                try {
                    await this.mediaAccessCallFeature.forbidOthersAudio();
                } catch(e) {
                    console.error(e);
                }
            },
            permitOthersAudio: async () => {
                try {
                    await this.mediaAccessCallFeature.permitOthersAudio();
                } catch(e) {
                    console.error(e);
                }
            },
            forbidOthersVideo: async () => {
                try {
                    await this.mediaAccessCallFeature.forbidOthersVideo();
                } catch(e) {
                    console.error(e);
                }
            },
            permitOthersVideo: async () => {
                try {
                    await this.mediaAccessCallFeature.permitOthersVideo();
                } catch(e) {
                    console.error(e);
                }
            },
            handleDisplayNameChanged: async (newValue, oldValue, reason) => {
                let messageBarText = `Display name changed from "${oldValue}" to "${newValue}" due to ${reason}`;
                this.setState({ callMessage: messageBarText })
            }
        }
    }

    getMenuItems() {
        let menuCallBacks = this.getParticipantMenuCallBacks();
        let menuItems = [
            {
                key: 'Teams Meeting Audio Dial-In Info',
                iconProps: { iconName: 'HandsFree'},
                text: 'Teams Meeting Audio Dial-In Info',
                onClick: (e) => menuCallBacks.meetingAudioConferenceDetails(e)
            }
        ]
        if (this.state.canRaiseHands && this.raiseHandFeature.getRaisedHands().length) {
            menuItems.push({
                key: 'Lower All Hands',
                iconProps: { iconName: 'HandsFree'},
                text: 'Lower All Hands',
                onClick: (e) => menuCallBacks.lowerAllHands(e)
            });
        }

        // Include the start spotlight option only if the local participant is has the capability
        // and is currently not spotlighted
        if (this.state.canSpotlight) {
            !this.state.isSpotlighted  && 
                menuItems.push({
                    key: 'Start Spotlight',
                    iconProps: { iconName: 'Focus', className: this.state.isSpotlighted ? "callFeatureEnabled" : ``},
                    text: 'Start Spotlight',
                    onClick: (e) => menuCallBacks.startSpotlight(this.identifier, e)
                });
            
        }
        // Include the stop all spotlight option only if the local participant has  the capability 
        // and the current spotlighted participant count is greater than 0
        if ((this.call.role == 'Presenter' || this.call.role == 'Organizer' || this.call.role == 'Co-organizer')
            && this.spotlightFeature.getSpotlightedParticipants().length) {
            menuItems.push({
                key: 'Stop All Spotlight',
                iconProps: { iconName: 'Focus'},
                text: 'Stop All Spotlight',
                onClick: (e) => menuCallBacks.stopAllSpotlight(e)
            });
        }

        // Include the stop spotlight option only if the local participant is spotlighted
        this.state.isSpotlighted && 
            menuItems.push({
                key: 'Stop Spotlight',
                iconProps: { iconName: 'Focus', className: this.state.isSpotlighted ? "callFeatureEnabled" : ``},
                text: 'Stop Spotlight',
                onClick: (e) => menuCallBacks.stopSpotlight(this.identifier, e)
            });
        
        this.recordingFeature.isTeamsConsentRequired && this.state.isRecordingActive && 
        menuItems.push({
            key: 'Provide consent to be Recorded',
            text: 'Provide consent to be Recorded',
            iconProps: { iconName: 'ReminderPerson'},
            onClick: (e) => menuCallBacks.consentToBeingRecorded(e)
        });

        this.transcriptionFeature.isTeamsConsentRequired && this.state.isTranscriptionActive && menuItems.push({
            key: 'Provide consent to be Transcribed',
            text: 'Provide consent to be Transcribed',
            iconProps: { iconName: 'ReminderPerson'},
            onClick: (e) => menuCallBacks.consentToBeingTranscribed(this.identifier, e)
        });

        // Proactively provide consent for recording and transcription in the call if it is required
        !this.state.isRecordingActive && !this.state.isTranscriptionActive && 
        this.recordingFeature.isTeamsConsentRequired && this.transcriptionFeature.isTeamsConsentRequired &&
        menuItems.push({
            key: 'Provide consent to being Recorded and Transcribed',
            text: 'Provide consent to being Recorded and Transcribed',
            iconProps: { iconName: 'ReminderPerson'},
            onClick: (e) => menuCallBacks.consentToBeingRecorded(e)
        });

        
        if (this.state.canForbidOthersAudio && this.state.meetingMediaAccess.isAudioPermitted){
            menuItems.push({
                key: 'Disable mic for all attendees',
                iconProps: { iconName: 'Focus'},
                text: 'Disable mic for all attendees',
                onClick: () => menuCallBacks.forbidOthersAudio()
            });
        }

        if (this.state.canForbidOthersAudio && !this.state.meetingMediaAccess.isAudioPermitted){
            menuItems.push({
                key: 'Enable mic for all attendees',
                iconProps: { iconName: 'Focus'},
                text: 'Enable mic for all attendees',
                onClick: () => menuCallBacks.permitOthersAudio()
            });
        }

        if (this.state.canForbidOthersVideo && this.state.meetingMediaAccess.isVideoPermitted){
            menuItems.push({
                key: 'Disable camera for all attendees',
                iconProps: { iconName: 'Focus'},
                text: 'Disable camera for all attendees',
                onClick: () => menuCallBacks.forbidOthersVideo()
            });
        }

        if (this.state.canForbidOthersVideo && !this.state.meetingMediaAccess.isVideoPermitted){
            menuItems.push({
                key: 'Enable camera for all attendees',
                iconProps: { iconName: 'Focus'},
                text: 'Enable camera for all attendees',
                onClick: () => menuCallBacks.permitOthersVideo()
            });
        }

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
        this.dataChannelRef?.current?.setParticipants(selectedParticipants);
    }

    handleMediaConstraint = (constraints) => {
        this.call.setConstraints(constraints);
    }

    handleVideoPin = (streamTuple, e) => {
        const checked = e.target.checked;
        const allRemoteParticipantStreams = this.state.allRemoteParticipantStreams;
        // If there is already 2 streams pinned and the user is trying to pin another stream, return
        if (allRemoteParticipantStreams.filter(streamTuple => streamTuple.isPinned).length >= 2 && checked) {
            allRemoteParticipantStreams.find(v => v === streamTuple).isPinned = false;
            this.setState({
                allRemoteParticipantStreams: allRemoteParticipantStreams,
            });
            return;
        }

        allRemoteParticipantStreams.forEach(v => {
            if (streamTuple === v) {
                v.isPinned = checked;
            } else {
                v.isPinned = !!v.isPinned;
            }
        });

        this.setState({
            allRemoteParticipantStreams: allRemoteParticipantStreams,
            isPinningActive: allRemoteParticipantStreams.some(v => v.isPinned)
        }, () => {
            this.updateListOfParticipantsToRender('Pinned videos changed');
        });
    }

    render() {
        const emojis = ['👍', '❤️', '😂', '👏', '😲'];
        const streamCount = this.state.allRemoteParticipantStreams.length;
        const mediaAccessMap = this.state.mediaAccessMap || new Map();
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
                <div className="ms-Grid-row mb-3">
                    <div className="ms-Grid-col ms-lg6">
                        <div>
                            {
                                this.state.callState !== 'Connected' &&
                                <div className="inline-block ringing-loader mr-2"></div>
                            }
                            <h2 className="inline-block">{this.state.callState !== 'Connected' ? `${this.state.callState}...` : `Connected`}</h2>
                            {
                                this.state.isRecordingActive && this.state.isTranscriptionActive ? <div>Recording and transcription are active</div> :
                                this.state.isRecordingActive ? <div>Recording is active</div> :
                                this.state.isTranscriptionActive ? <div>Transcription is active</div> : null
                            }
                        </div>
                    </div>
                    {
                        this.call &&
                        <CurrentCallInformation sentResolution={this.state.sentResolution} call={this.call} />
                    }
                </div>
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col">
                        <h2 className="inline-block" onClick={() => this.setState((prevState) => ({isShowParticipants: !prevState.isShowParticipants}))}>&equiv; Participants</h2>
                    </div>
                </div>
                <div className="ms-Grid-row">
                    {
                        this.state.callState === 'Connected' && this.state.isShowParticipants &&
                        <div className="ms-Grid-col ms-lg12">
                            <div>
                                {   this.state.showAddParticipantPanel &&
                                    <AddParticipantPopover call={this.call} />
                                }
                            </div>
                            <div>
                                {
                                    (this.state.lobbyParticipantsCount > 0) &&
                                    <Lobby call={this.call} capabilitiesFeature={this.capabilitiesFeature} lobbyParticipantsCount={this.state.lobbyParticipantsCount} />
                                }
                            </div>
                            {
                                this.state.dominantSpeakerMode &&
                                <div>
                                    Current dominant speaker: {this.state.dominantRemoteParticipant ? utils.getIdentifierText(this.state.dominantRemoteParticipant.identifier) : `None`}
                                </div>
                            }
                            {
                                this.state.remoteParticipants.length === 0 &&
                                <p>No other participants currently in the call</p>
                            }
                            <ul className="p-0 m-0">
                                {this.state.remoteParticipants.map(remoteParticipant => {
                                        const participantMediaAccess = mediaAccessMap?.get(remoteParticipant.identifier.rawId);
                                        return ( <RemoteParticipantCard
                                            key={`${utils.getIdentifierText(remoteParticipant.identifier)}`}
                                            remoteParticipant={remoteParticipant}
                                            call={this.call}
                                            menuOptionsHandler={this.getParticipantMenuCallBacks()}
                                            onSelectionChanged={(identifier, isChecked) => this.remoteParticipantSelectionChanged(identifier, isChecked)}
                                            capabilitiesFeature={this.capabilitiesFeature}
                                            mediaAccess={participantMediaAccess}
                                            />);
                                })}
                                
                            </ul>
                            
                        </div>
                    }
                </div>
                <div className="ms-Grid-row">
                    {
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
                                streamCount={streamCount}
                            />
                    }
                </div>
                <div className="ms-Grid-row">
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
                                    isPinningActive={this.state.isPinningActive}
                                    isPinned={v.isPinned}
                                    remoteParticipant={v.participant}
                                    dominantSpeakerMode={this.state.dominantSpeakerMode}
                                    dominantRemoteParticipant={this.state.dominantRemoteParticipant}
                                    call={this.call}
                                    showMediaStats={this.state.logMediaStats}
                                    streamCount={streamCount}
                                />
                            )
                        }
                    </div>
                </div>
                <div className="ms-Grid-row">
                    <div className="text-center mt-4">
                        <span className="in-call-button"
                            title = {`${this.state.canOnVideo ? (this.state.videoOn ? 'Turn your video off' : 'Turn your video on') : 'Video is disabled'}`}
                            variant="secondary"
                            onClick={() => this.handleVideoOnOff()}>
                                <Icon iconName={`${this.state.canOnVideo ? (this.state.videoOn ? 'Video' : 'VideoOff2') : 'VideoOff'}`} />
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.canUnMuteMic ? (this.state.micMuted ? 'Unmute your microphone' : 'Mute your microphone') : 'Microphone is disabled'}`}
                            variant="secondary"
                            onClick={() => this.handleMicOnOff()}>
                            {
                                this.state.canUnMuteMic && !this.state.micMuted &&
                                <Icon iconName="Microphone" />
                            }
                            {
                                (this.state.canUnMuteMic && this.state.micMuted) &&
                                <Icon iconName="MicOff2" />
                            }
                            {
                                !this.state.canUnMuteMic && <Icon iconName="MicOff" />
                            }
                        </span>
                        <span className="in-call-button"
                            onClick={() => this.call.hangUp()}>
                            <Icon iconName="DeclineCall" />
                        </span>
                        <span className="in-call-button"
                            title="Settings"
                            variant="secondary"
                            onClick={() => this.setState({ showSettings: true })}>
                            <Icon iconName="Settings" />
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.screenSharingOn && this.localScreenSharingStream?.mediaStreamType === 'ScreenSharing' ? 'Stop' : 'Start'} screen sharing a screen/tab/app`}
                            variant="secondary"
                            onClick={() => this.handleScreenSharingOnOff()}>
                            {
                                this.state.canShareScreen && (
                                    !this.state.screenSharingOn ||
                                    (this.state.screenSharingOn && this.state.localScreenSharingMode !== 'StartWithNormal')
                                ) &&
                                <Icon iconName="TVMonitor" />
                            }
                            {
                                (!this.state.canShareScreen) || (this.state.screenSharingOn && this.state.localScreenSharingMode === 'StartWithNormal') &&
                                <Icon iconName="CircleStop" />
                            }
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.showAddParticipantPanel ? 'Hide' : 'Show'} add participant panel`}
                            variant="secondary"
                            onClick={() => this.setState((prevState) => ({showAddParticipantPanel: !prevState.showAddParticipantPanel}))}>
                            {
                                this.state.showAddParticipantPanel &&
                                <Icon iconName="AddFriend" />
                            }
                            {
                                !this.state.showAddParticipantPanel &&
                                <Icon iconName="AddFriend" />
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
                        {
                            this.state.canMuteOthers &&
                            <span className="in-call-button"
                                title={`Mute all other participants`}
                                variant="secondary"
                                onClick={() => this.handleMuteAllRemoteParticipants()}>
                                <Icon iconName="VolumeDisabled" />
                            </span>
                        }
                        <span className="in-call-button"
                            title={`${this.state.screenSharingOn && this.localScreenSharingStream?.mediaStreamType === 'RawMedia' ? 'Stop' : 'Start'} screen sharing a dummy stream`}
                            variant="secondary"
                            onClick={() => this.handleRawScreenSharingOnOff()}>
                            {
                                this.state.canShareScreen && (
                                    !this.state.screenSharingOn ||
                                    (this.state.screenSharingOn && this.state.localScreenSharingMode !== 'StartWithDummy')
                                ) &&
                                <Icon iconName="Tablet" />
                            }
                            {
                                (!this.state.canShareScreen) || (this.state.screenSharingOn && this.state.localScreenSharingMode === 'StartWithDummy') &&
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
                            title={`${this.state.captionOn ? 'Turn captions off' : 'Turn captions on'}`}
                            variant="secondary"
                            hidden={this.state.callState !== 'Connected'}
                            onClick={() => { this.setState((prevState) => ({ captionOn: !prevState.captionOn }))}}>
                            {
                                this.state.captionOn &&
                                <Icon iconName="TextBox" />
                            }
                            {
                                !this.state.captionOn &&
                                <Icon iconName="TextBox" />
                            }
                        </span>
                        { Features.RealTimeText &&
                            <span className="in-call-button"
                                title={`${this.state.realTimeTextOn ? 'Hide RealTimeText Card' : 'Show RealTimeText Card'}`}
                                variant="secondary"
                                hidden={this.state.callState !== 'Connected'}
                                onClick={() => { 
                                    if (!this.state.firstRealTimeTextReceivedorSent) {
                                        this.setState((prevState) => ({ realTimeTextOn: !prevState.realTimeTextOn }))
                                    } else {
                                        this.setState((prevState) => ({ showCanNotHideorCloseRealTimeTextBanner: true}))
                                    }}}>
                                {
                                    this.state.realTimeTextOn &&
                                    <Icon iconName="Comment" />
                                }
                                {
                                    !this.state.realTimeTextOn &&
                                    <Icon iconName="Comment" />
                                }
                            </span>
                        }
                        <span className="in-call-button"
                            title={`${this.state.showDataChannel ? 'Turn data channel off' : 'Turn data channel on'}`}
                            variant="secondary"
                            onClick={() => { this.setState((prevState) => ({ showDataChannel: !prevState.showDataChannel }))}}>
                            {
                                this.state.showDataChannel &&
                                <Icon iconName="Send" />
                            }
                            {
                                !this.state.showDataChannel &&
                                <Icon iconName="Send" />
                            }
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.dominantSpeakersListActive ? 'Hide dominant speakers list' : 'Show dominant speakers list'}`}
                            variant="secondary"
                            onClick={() => this.handleDominantSpeakersListActive()}>
                            {
                                this.state.dominantSpeakersListActive &&
                                <Icon iconName="PeopleBlock" />
                            }
                            {
                                !this.state.dominantSpeakersListActive &&
                                <Icon iconName="People" />
                            }
                        </span>
                        <span className="in-call-button"
                            title={`${this.state.dominantSpeakerMode ? 'Render all participants videos' : 'Render most dominant speaker video only'}`}
                            variant="secondary"
                            onClick={() => this.toggleDominantSpeakerMode()}>
                            {
                                this.state.dominantSpeakerMode &&
                                <Icon iconName="UserRemove" />
                            }
                            {
                                !this.state.dominantSpeakerMode &&
                                <Icon iconName="ReminderPerson" />
                            }
                        </span>
                        { this.state.canRaiseHands &&
                            <span className="in-call-button"
                                title={`${this.state.isHandRaised  ? 'LowerHand' : 'RaiseHand'}`}
                                variant="secondary"
                                onClick={() => this.handleRaiseHand()}>
                                <Icon iconName="HandsFree"  className={this.state.isHandRaised ? "callFeatureEnabled" : ``}/>
                            </span>
                        }
                        {
                            <span className="in-call-button"
                                title={`Pin 2 videos`}
                                variant="secondary"
                                onClick={() =>  this.setState({showPin2VideosList: !this.state.showPin2VideosList})}>
                                <Icon iconName="Pinned"/>
                            </span>
                        }
                        <span className="in-call-button"
                            title='Like Reaction'
                            variant="secondary"
                            onClick={() => this.handleClickEmoji(0)}
                            style={{ cursor: 'pointer' }}>
                                {emojis[0]}
                        </span>
                        <span className="in-call-button"
                            title='Heart Reaction'
                            variant="secondary"
                            onClick={() => this.handleClickEmoji(1)}
                            style={{ cursor: 'pointer' }}>
                                {emojis[1]}
                        </span>
                        <span className="in-call-button"
                            title='Laugh Reaction'
                            variant="secondary"
                            onClick={() => this.handleClickEmoji(2)}
                            style={{ cursor: 'pointer' }}>
                                {emojis[2]}
                        </span>
                        <span className="in-call-button"
                            title='Applause Reaction'
                            variant="secondary"
                            onClick={() => this.handleClickEmoji(3)}
                            style={{ cursor: 'pointer' }}>
                                {emojis[3]}
                        </span>
                        <span className="in-call-button"
                            title='Surprised Reaction'
                            variant="secondary"
                            onClick={() => this.handleClickEmoji(4)}
                            style={{ cursor: 'pointer' }}>
                                {emojis[4]}
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
                { this.state.pptLiveActive &&
                    <div className= "pptLive" ref={this.pptLiveHtml} />
                }
                {
                    this.state.videoOn && this.state.canOnVideo &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Local video preview</h3>
                        </div>
                        <div className="ms-Grid-row">
                            <div className="ms-Grid-col ms-sm12 ms-md4 ms-lg4">
                                <LocalVideoPreviewCard
                                    ref={this.localVideoPreviewRef}
                                    identifier={this.identifier}
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

                                {
                                    this.isSetCallConstraints &&
                                    <div>
                                        <h4>Video Send Constraints</h4>
                                        <MediaConstraint
                                            onChange={this.handleMediaConstraint}
                                            disabled={false}/>
                                    </div>
                                }

                            </div>
                            <div className='ms-Grid-col ms-sm12 ms-md5 md-lg6'>
                                <VideoEffectsContainer call={this.call} />
                            </div>
                        </div>
                    </div>
                }
                {
                    this.state.localScreenSharingMode &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Local screen sharing preview</h3>
                        </div>
                        <div className="ms-Grid-row">
                            {
                                <div className="ms-Grid-col ms-sm12 ms-md6 ms-lg6">
                                    <LocalVideoPreviewCard
                                        ref={this.localScreenSharingPreviewRef}
                                        identifier={this.identifier}
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
                {   this.state.dominantSpeakersListActive &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Dominant Speakers</h3>
                        </div>
                        <div className="dominant-speakers-list">
                           {
                                this.state.dominantSpeakers.map((dominantSpeaker, index) =>
                                    <div key={index}>
                                        <div>
                                            Index {index}
                                        </div>
                                        <div className="ml-3">
                                            mri: {utils.getIdentifierText(dominantSpeaker?.identifier)}
                                        </div>
                                        <div className="ml-3">
                                            displayName: {dominantSpeaker?.displayName ?? 'None'}
                                        </div>
                                    </div>
                                )
                           }
                        </div>
                    </div>
                }
                {
                    this.state.captionOn &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Captions</h3>
                        </div>
                        <div className="md-grid-row">
                            {
                                this.state.captionOn &&
                                <CallCaption call={this.call} isTeamsUser={this.isTeamsUser}/>
                            }
                        </div>
                    </div>
                }
                {
                    Features.RealTimeText && this.state.realTimeTextOn &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>RealTimeText</h3>
                        </div>
                        <div className="md-grid-row">
                            {
                                this.state.realTimeTextOn &&
                                this.state.firstRealTimeTextReceivedorSent &&
                                this.state.showCanNotHideorCloseRealTimeTextBanner &&
                                <MessageBar
                                    messageBarType={MessageBarType.warn}
                                    isMultiline={true}
                                    onDismiss={() => { this.setState({ showCanNotHideorCloseRealTimeTextBanner: undefined }) }}
                                    dismissButtonAriaLabel="Close">
                                    <b>Note: RealTimeText can not be closed or hidden after you have sent or received a message.</b>
                                </MessageBar>
                            }
                            {
                                this.state.realTimeTextOn &&
                                <RealTimeTextCard
                                    call={this.call}
                                    state={{
                                        firstRealTimeTextReceivedorSent: this.state.firstRealTimeTextReceivedorSent,
                                        setFirstRealTimeTextReceivedorSent: this.setFirstRealTimeTextReceivedorSent
                                    }}
                                />
                            }
                        </div>
                    </div>
                }
                {
                    this.state.showDataChannel &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Data Channel</h3>
                        </div>
                        <div className="md-grid-row">
                        {
                            this.state.callState === 'Connected' &&
                                <DataChannelCard call={this.call} ref={this.dataChannelRef} remoteParticipants={this.state.remoteParticipants} />
                        }
                        </div>
                    </div>
                }
                {
                    this.state.callState === 'Connected' &&
                    <div className='mt-5'>
                        <div className='ms-Grid-row'>
                            <h3>Audio effects and enhancements</h3>
                        </div>
                        <div className='ms-Grid-row'>
                            <AudioEffectsContainer call={this.call} deviceManager={this.deviceManager} />
                        </div>
                    </div>
                }
                {
                    this.state.callState === 'Connected' &&
                    <div className="mt-5">
                        <div className="ms-Grid-row">
                            <h3>Meeting Reactions</h3>
                        </div>
                        <div className="ms-Grid-row>">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Identifier</th>
                                        <th>Reaction</th>
                                        <th>Receive TimeStamp</th>
                                    </tr>
                                </thead>
                               <tbody>
                                   {
                                       this.state.reactionRows.map((row, index) => (
                                           <tr key={index}>
                                               <td>{row.participantIdentifier}</td>
                                               <td>{row.reaction}</td>
                                               <td>{row.receiveTimestamp}</td>
                                           </tr>
                                       ))
                                   }
                               </tbody>
                            </table>
                        </div>
                    </div>
                }
                {
                    this.state.showPin2VideosList &&
                    <div className="mt-5">
                        <div>
                            <h3>
                                Pin 2 videos
                            </h3>
                        </div>
                        <div>
                            {this.state.allRemoteParticipantStreams.map((streamTuple) => (
                                streamTuple.participant.state === 'Connected' &&
                                <div key={utils.getIdentifierText(streamTuple.participant.identifier)}>
                                    <input
                                        type="checkbox"
                                        checked={streamTuple.isPinned}
                                        onChange={(e) => this.handleVideoPin(streamTuple, e)}
                                    />
                                    {utils.getIdentifierText(streamTuple.participant.identifier)}
                                </div>
                            ))}
                        </div>
                    </div>
                }
            </div>
        );
    }
}