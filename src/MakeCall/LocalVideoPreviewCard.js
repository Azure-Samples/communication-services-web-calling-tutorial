import React from "react";
import { LocalVideoStream, VideoStreamRenderer} from '@azure/communication-calling';
export default class LocalVideoPreviewCard extends React.Component {
    constructor(props) {
        super(props);
        this.stream = props.stream;
        this.type = this.stream.mediaStreamType;
        this.view = undefined;
    }

    async componentDidMount() {
        try {
            this.renderer = new VideoStreamRenderer(this.stream);
            this.view = await this.renderer.createView();
            const targetContainer = document.getElementById(`local${this.type}Renderer`);
            if (this.type === 'ScreenSharing' || this.type === 'RawMedia') {
                this.view.target.querySelector('video').style.width = targetContainer.style.width;
            }
            targetContainer.appendChild(this.view.target);
        } catch (error) {
            console.error('Failed to render preview', error);
        }
    }

    async componentWillUnmount() {
        this.view.dispose();
        this.view = undefined;
    }

    render() {
        return (
            <div style={{ width: '100%' }} id={ `local${this.type}Renderer` }></div>
        );
    }
}
