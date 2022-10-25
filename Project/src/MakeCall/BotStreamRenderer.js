import React from "react";
import { VideoStreamRenderer } from "@azure/communication-calling";
export default class BotStreamRenderer extends React.Component {
    constructor(props) {
        super(props);
        this.stream = props.stream;
        this.remoteParticipantType = props.remoteParticipantType;
        this.componentId = `${this.remoteParticipantType}-${this.stream.mediaStreamType}-${this.stream.id}`;
        this.videoContainerId = this.componentId + '-videoContainer';
        this.videoContainer = undefined;
        this.renderer = undefined;
        this.view = undefined;
        this.loadingSpinner = document.createElement('div');
        this.loadingSpinner.className = 'remote-video-loading-spinner';
        this.state = {
            displayName: this.remoteParticipantType.trim()
        };
    }

    /**
     * Start stream after DOM has rendered
     */
    async componentDidMount() {
        document.getElementById(this.componentId).hidden = true;
        this.videoContainer = document.getElementById(this.videoContainerId);

        console.log(`[App][StreamMedia][id=${this.stream.id}] handle new stream`);
        console.log(`[App][StreamMedia][id=${this.stream.id}] stream info - ` + 
                    `streamId=${this.stream.id}, streamType=${this.stream.mediaStreamType}, ` + 
                    `isReceiving=${this.stream.isReceiving}`);

        /**
         * This feature is alpha
         * @beta
         */
        console.log(`[App][StreamMedia][id=${this.stream.id}] subscribing to isRenderingChanged`);
        this.stream.on('isReceivingChanged', () => {
            try {
                const isReceiving = this.stream.isReceiving;
                const isLoadingSpinnerActive = this.videoContainer.contains(this.loadingSpinner);
                if (!isReceiving && !isLoadingSpinnerActive) {
                    this.videoContainer.appendChild(this.loadingSpinner);
                } else if (isReceiving && isLoadingSpinnerActive) {
                    this.videoContainer.removeChild(this.loadingSpinner);
                }
            } catch (e) {
                console.error(e);
            }
        });

        try {
            if (!this.renderer) {
                await this.createRenderer();
                this.attachRenderer();
            }
        } catch (e) {
            console.error(e);
        }
    }

    getRenderer() {
        return this.renderer;
    }

    async createRenderer() {
        console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] attempt to render stream type=${this.stream.mediaStreamType}, id=${this.stream.id}`);
        if (!this.renderer) {
            this.renderer = new VideoStreamRenderer(this.stream);
            this.view = await this.renderer.createView();
            console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] createView resolved, appending view`);
        } else {
            throw new Error(`[App][StreamMedia][id=${this.stream.id}][createRenderer] stream already has a renderer`);
        }
    }

    async attachRenderer() {
        console.info(`[App][StreamMedia][id=${this.stream.id}][attachRenderer] attempt to attach view=${this.view.target}, id=${this.stream.id} to DOM, under container id=${this.videoContainerId}`);
        try {
            if(!this.view.target) {
                throw new Error(`[App][StreamMedia][id=${this.stream.id}][attachRenderer] target is undefined. Must create renderer first`);
            }
            document.getElementById(this.componentId).hidden = false;
            document.getElementById(this.videoContainerId).appendChild(this.view.target);
        } catch (e) {
            console.error(e);
        }
    }

    disposeRenderer() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = undefined;
            document.getElementById(this.componentId).hidden = true;
        } else {
            console.warn(`[App][StreamMedia][id=${this.stream.id}][disposeRender] no renderer to dispose`);
        }
    }

    render() {
        return (
            <div id={this.componentId} className={`py-3 ms-Grid-col ms-sm-12 ms-lg12 ms-xl12 ms-xxl6`}>
                <div className={`remote-video-container`} id={this.videoContainerId}>
                    <h4 className="video-title">
                        {this.state.displayName}
                    </h4>
                </div>
            </div>
        );
    }
}