import React from "react";
import { LocalAudioStream } from '@azure/communication-calling';

export default class VolumeVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.localVolumeLevelSubscription = undefined;
        this.remoteVolumeLevelSubscription = undefined;
        this.state = {
            localVolumeLevel: 0,
            remoteVolumeLevel: 0,
            localVolumeIndicator: undefined,
            remoteVolumeIndicator: undefined,
        };
    }

    async componentWillMount() {
        if (this.call) {
            let localVolumeStateSetter = undefined;
            let handleSelectedMicrophoneVolumeSubscription = async () => {        
                let localVolumeIndicator = await (new LocalAudioStream(this.deviceManager.selectedMicrophone).getVolume());
                localVolumeStateSetter = ()=>{
                    this.setState({ localVolumeLevel: localVolumeIndicator.level });
                }
                localVolumeIndicator.on('levelChanged', localVolumeStateSetter);
                this.localVolumeLevelSubscription = localVolumeStateSetter;
                this.setState({ localVolumeIndicator: localVolumeIndicator });                             
            }
            handleSelectedMicrophoneVolumeSubscription();

<<<<<<< HEAD
=======
            let remoteVolumeStateSetter = undefined;
            let handleRemoteVolumeSubscription = async () => {
                if(this.call.remoteAudioStreams.length>0)  {
                    let remoteVolumeIndicator = await this.call.remoteAudioStreams[0].getVolume();
                remoteVolumeStateSetter = ()=>{
                    this.setState({ remoteVolumeLevel: remoteVolumeIndicator.level });
                }
                remoteVolumeIndicator.on('levelChanged', remoteVolumeStateSetter);
                this.remoteVolumeLevelSubscription = remoteVolumeStateSetter;
                this.setState({ remoteVolumeIndicator: remoteVolumeIndicator });
                }                                            
            }

>>>>>>> 6a1ec39 (wip)
            this.deviceManager.on('selectedSpeakerChanged', () => {
                this.setState({ selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id });
            });

            this.deviceManager.on('selectedMicrophoneChanged', () => {
                this.setState({ selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id });
                handleSelectedMicrophoneVolumeSubscription();
            });
<<<<<<< HEAD
        }
    }

    async componentWillUnmount() {
        if ((!!this.state.localVolumeIndicator) && (!!this.localVolumeLevelSubscription)) {
            this.state.localVolumeIndicator.off('levelChanged', this.localVolumeLevelSubscription);
        }
        if((!!this.state.remoteVolumeIndicator) && (!!this.remoteVolumeLevelSubscription)) {
=======

            const callStateChanged = () => {
                if (this.call.state === 'Connected') {
                    this.call.on('remoteAudioStreamsUpdated', handleRemoteVolumeSubscription)
                } else if (this.call.state === 'Disconnected') {
                    this.unsubscribe();
                }
            }
            callStateChanged();
            this.call.on('stateChanged', callStateChanged);
            this.deviceManager.on('selectedMicrophoneChanged', () => {
                handleSelectedMicrophoneVolumeSubscription();
            });

        }
    }

    unsubscribe() {
        if (this.localVolumeLevelSubscription){
            this.state.localVolumeIndicator.off('levelChanged', this.localVolumeLevelSubscription);
        }
        if(!!this.remoteVolumeIndicator){
>>>>>>> 6a1ec39 (wip)
            this.state.remoteVolumeIndicator.off('levelChanged', this.remoteVolumeLevelSubscription);
        }
    }

<<<<<<< HEAD
=======

    async componentWillUnmount() {
        // this.unsubscribe();
    }


>>>>>>> 6a1ec39 (wip)
    render() {
        return (
            <div className="volume-indicatordiv">
                <div className="elements">
                    <label>Remote Volume Visualizer</label>
<<<<<<< HEAD
                    <div className="volumeVisualizer" style={{"--volume":2*this.props.remoteVolumeLevel + "%"}}></div>
=======
                    <div className="volumeVisualizer" style={{"--volume":2*this.state.remoteVolumeLevel + "%"}}></div>
>>>>>>> 6a1ec39 (wip)
                </div>
                <div className="elements">
                    <label>Selected Microphone Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{"--volume":2*this.state.localVolumeLevel + "%"}}></div>
                </div>
            </div>
        );
    }
}
