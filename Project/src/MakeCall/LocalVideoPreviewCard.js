import React from "react";
import { VideoStreamRenderer} from '@azure/communication-calling';
import { utils } from '../Utils/Utils';

export default class LocalVideoPreviewCard extends React.Component {
    constructor(props) {
        super(props);
        this.identifier = props.identifier;
        this.stream = props.stream;
        this.type = this.stream.mediaStreamType;
        this.view = undefined;
        this.componentId = `${utils.getIdentifierText(this.identifier)}-local${this.type}Renderer`;
    }

    async componentDidUpdate() {
        if (this.props.onHold) {
            this.onHoldDispose();
        } else {
            this.onResumeStart();
        }
    }

    async componentDidMount() {
        try {
            this.renderer = new VideoStreamRenderer(this.stream);
            this.view = await this.renderer.createView();
            const targetContainer = document.getElementById(this.componentId);
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

    onHoldDispose() {
        if (this.props.onHold && this.view) {
            console.log('holding local video preview');
            this.view.dispose();
            this.view = undefined;
        }
    }

    async onResumeStart() {
        if (!this.props.onHold) {
            try {
                this.renderer = new VideoStreamRenderer(this.stream);
                this.view = await this.renderer.createView();
                const targetContainer = document.getElementById(this.componentId);
                if (this.type === 'ScreenSharing' || this.type === 'RawMedia') {
                    this.view.target.querySelector('video').style.width = targetContainer.style.width;
                }
                targetContainer.appendChild(this.view.target);
            } catch (error) {
                console.error('Failed to render preview', error);
            }
        }
    }

    render() {
        return (
            <div style={{ width: '100%' }} id={this.componentId}></div>
        );
    }
}
