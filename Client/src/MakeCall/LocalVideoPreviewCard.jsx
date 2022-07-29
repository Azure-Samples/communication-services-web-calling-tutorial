import React from "react";
import { LocalVideoStream, VideoStreamRenderer} from '@azure/communication-calling';
export default class LocalVideoPreviewCard extends React.Component {
    constructor(props) {
        super(props);
        this.deviceManager = props.deviceManager;
        this.selectedCameraDeviceId = props.selectedCameraDeviceId;
    }

    async componentDidMount() {
        try {
            const cameras = await this.deviceManager.getCameras();
            this.cameraDeviceInfo = cameras.find(cameraDevice => {
                return cameraDevice.id === this.selectedCameraDeviceId;
            });
            const localVideoStream = new LocalVideoStream(this.cameraDeviceInfo);
            const renderer = new VideoStreamRenderer(localVideoStream);
            this.view = await renderer.createView();
            const targetContainer = document.getElementById('localVideoRenderer');
            targetContainer.appendChild(this.view.target);
        } catch (error) {
            console.error(error);
        }
    }

    render() {
        return (
            <div>
                <div style={{ marginBottom: "0.5em", padding: "0.5em" }}>
                    <div id="localVideoRenderer"></div>
                </div>
            </div>
        );
    }
}
