import React from "react";
import { LocalAudioStream } from '@azure/communication-calling';

export default class VolumeVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.localVolumeLevelSubscription = undefined;
        this.state = {
            localVolumeLevel: 0,
            localVolumeIndicator: undefined,
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

            this.deviceManager.on('selectedSpeakerChanged', () => {
                this.setState({ selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id });
            });

            this.deviceManager.on('selectedMicrophoneChanged', () => {
                this.setState({ selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id });
                handleSelectedMicrophoneVolumeSubscription();
            });
        }
    }

    async componentWillUnmount() {
        if ((!!this.state.localVolumeIndicator) && (!!this.localVolumeLevelSubscription)) {
            this.state.localVolumeIndicator.off('levelChanged', this.localVolumeLevelSubscription);
        }
        if((!!this.state.remoteVolumeIndicator) && (!!this.remoteVolumeLevelSubscription)) {
            this.state.remoteVolumeIndicator.off('levelChanged', this.remoteVolumeLevelSubscription);
        }
    }

    render() {
        return (
            <div className="volume-indicatordiv">
                <div className="elements">
                    <label>Remote Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{"--volume":2*this.props.remoteVolumeLevel + "%"}}></div>
                </div>
                <div className="elements">
                    <label>Selected Microphone Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{"--volume":2*this.state.localVolumeLevel + "%"}}></div>
                </div>
            </div>
        );
    }
}
