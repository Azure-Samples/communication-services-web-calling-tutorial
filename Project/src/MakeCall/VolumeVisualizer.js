import React from "react";
import { LocalAudioStream } from '@azure/communication-calling';

export default class VolumeVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.state = {
            localVolumeLevel: 0,
            remoteVolumeLevel: 0,
            localVolumeLevelSubscription: undefined,
            remoteVolumeLevelSubscription: undefined,
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
                this.setState({ localVolumeLevelSubscription: localVolumeStateSetter });
                this.setState({ localVolumeIndicator: localVolumeIndicator });                             
            }
            handleSelectedMicrophoneVolumeSubscription();

            let remoteVolumeStateSetter = undefined;
            let handleRemoteVolumeSubscription = async () => {                
                let remoteVolumeIndicator = await this.call.remoteAudioStreams[0].getVolume();
                remoteVolumeStateSetter = ()=>{
                    this.setState({ remoteVolumeLevel: remoteVolumeIndicator.level });
                }
                remoteVolumeIndicator.on('levelChanged', remoteVolumeStateSetter);
                this.setState({ remoteVolumeLevelSubscription: remoteVolumeStateSetter });
                this.setState({ remoteVolumeIndicator: remoteVolumeIndicator });                              
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
                    this.componentWillUnmount()
                }
            }
            callStateChanged();
            this.call.on('stateChanged', callStateChanged);
            this.deviceManager.on('selectedMicrophoneChanged', () => {
                handleSelectedMicrophoneVolumeSubscription();
            });

        }
    }

    async componentWillUnmount() {
        this.state.localVolumeIndicator.off('levelChanged', this.state.localVolumeLevelSubscription);
        this.state.remoteVolumeIndicator.off('levelChanged', this.state.remoteVolumeLevelSubscription);
    }


    render() {
        return (
            <div className="volume-indicatordiv">
                <div className='elements'>
                    <label>Remote Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{'--volume':this.state.remoteVolumeLevel + '%'}}></div>
                </div>
                <div className='elements'>
                    <label>Selected Microphone Volume Visualizer</label>
                    <div className="volumeVisualizer" style={{'--volume':this.state.localVolumeLevel + '%'}}></div>
                </div>
            </div>
        );
    }
}
