import React, { useEffect, createRef } from "react";
import { utils } from '../Utils/Utils';
import { VideoStreamRenderer } from "@azure/communication-calling";
export default class StreamMedia extends React.Component {
    constructor(props) {
        super(props);
        this.stream = props.stream;
        this.remoteParticipant = props.remoteParticipant;
        this.componentId = `${utils.getIdentifierText(this.remoteParticipant.identifier)}-${this.stream.mediaStreamType}-${this.stream.id}`;
        this.videoContainerId = this.componentId + '-videoContainer';
        this.state = {
            isSpeaking: false,
            displayName: this.remoteParticipant.displayName?.trim()
        };
    }

    /**
     * Start stream after DOM has rendered
     */
    async componentDidMount() {
        let componentContainer = document.getElementById(this.componentId);
        componentContainer.hidden = true;

        this.remoteParticipant.on('isSpeakingChanged', () => {
            this.setState({ isSpeaking: this.remoteParticipant.isSpeaking });
        });

        this.remoteParticipant.on('displayNameChanged', () => {
            this.setState({ displayName: this.remoteParticipant.displayName?.trim() });
        })

        console.log(`[App][StreamMedia][id=${this.stream.id}] handle new stream`);
        console.log(`[App][StreamMedia][id=${this.stream.id}] stream info - streamId=${this.stream.id}, streamType=${this.stream.mediaStreamType} isAvailable=${this.stream.isAvailable}`);
        let renderer = new VideoStreamRenderer(this.stream);
        let view;
        let videoContainer;

        const renderStream = async () => {
            console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] attempt to render stream type=${this.stream.mediaStreamType}, id=${this.stream.id}`);
            if (!view) {
                console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] call createView`);
                try {
                    view = await renderer.createView();
                } catch (e) {
                    console.warn(`[App][StreamMedia][id=${this.stream.id}][renderStream] createView failed`);
                    console.error(e);
                }
                console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] createView resolved`);
            }
            videoContainer = document.getElementById(this.videoContainerId);
            console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] view created`);
            if (!videoContainer?.hasChildNodes()) {
                console.info(`[App][StreamMedia][id=${this.stream.id}][renderStream] videoContainer appending view`);
                videoContainer.appendChild(view.target);
            } else {
                console.warn(`[App][StreamMedia][id=${this.stream.id}][renderStream] unable to append view container has child nodes!`);
            }
        }

        console.log(`[App][StreamMedia][id=${this.stream.id}] subscribing to isAvailableChanged`);
        this.stream.on('isAvailableChanged', async () => {
            console.log(`[App][StreamMedia][id=${this.stream.id}][isAvailableChanged] triggered`);
            
            if (this.stream.isAvailable) {
                console.log(`[App][StreamMedia][id=${this.stream.id}][isAvailableChanged] isAvailable=${this.stream.isAvailable}`);
                componentContainer.hidden = false;
                await renderStream();
            } else {
                console.log(`[App][StreamMedia][id=${this.stream.id}][isAvailableChanged] isAvailable=${this.stream.isAvailable}`);
                componentContainer.hidden = true;

            }
        });
        console.log(`[App][StreamMedia][id=${this.stream.id}] checking initial value - isAvailable=${this.stream.isAvailable}`);
        if (this.stream.isAvailable) {
            componentContainer.hidden = false;
            await renderStream();
        }
    }

    render() {
        return (
            <div id={this.componentId} className="py-3 ms-Grid-col ms-sm-12 ms-lg12 ms-xl12 ms-xxl4">
                <h4 className="video-title">{this.state.displayName ? this.state.displayName : utils.getIdentifierText(this.remoteParticipant.identifier)}</h4>
                <div className={`w-100 ${this.state.isSpeaking ? `speaking-border-for-video` : ``}`} id={this.videoContainerId}></div>
            </div>
        );
    }
}



