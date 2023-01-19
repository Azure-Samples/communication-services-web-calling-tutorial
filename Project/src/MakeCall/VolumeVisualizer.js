import React from "react";
import { LocalAudioStream } from '@azure/communication-calling';

export default class VolumeVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.localAudioStream = undefined;
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

    async componentDidMount() {
        if (this.call) {
            let localVolumeStateSetter = undefined;
            let handleSelectedMicrophoneVolumeSubscription = async () => {
                this.localAudioStream?.dispose();  
                this.localAudioStream = new LocalAudioStream(this.deviceManager.selectedMicrophone);
                let localVolumeIndicator = await (this.localAudioStream.getVolume());
                localVolumeStateSetter = ()=>{
                    this.setState({ localVolumeLevel: localVolumeIndicator.level });
                }
                localVolumeIndicator.on('levelChanged', localVolumeStateSetter);
                this.localVolumeLevelSubscription = localVolumeStateSetter;
                this.setState({ localVolumeIndicator: localVolumeIndicator });                             
            }
            handleSelectedMicrophoneVolumeSubscription();

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

            this.deviceManager.on('selectedSpeakerChanged', () => {
                this.setState({ selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id });
            });

            this.deviceManager.on('selectedMicrophoneChanged', () => {
                this.setState({ selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id });
                handleSelectedMicrophoneVolumeSubscription();
            });

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
            this.state.remoteVolumeIndicator.off('levelChanged', this.remoteVolumeLevelSubscription);
        }
    }


    async componentWillUnmount() {
        this.unsubscribe();
    }


    render() {
        return (
            <div className="volume-indicatordiv">
                <div className="elements">
                    <label>Remote Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{"--volume":2*this.state.remoteVolumeLevel + "%"}}></div>
                </div>
                <div className="elements">
                    <label>Selected Microphone Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{"--volume":2*this.state.localVolumeLevel + "%"}}></div>
                </div>
            </div>
        );
    }
}
