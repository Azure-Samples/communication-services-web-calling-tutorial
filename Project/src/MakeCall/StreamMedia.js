import React, { useEffect, createRef } from "react";
import { utils } from '../Utils/Utils';
import { Renderer } from "@azure/communication-calling";
export default class StreamMedia extends React.Component {
    constructor(props) {
        super(props);
        this.stream = props.stream;
        this.remoteParticipant = props.remoteParticipant;
        this.componentId = `${utils.getIdentifierText(this.remoteParticipant.identifier)}-${this.stream.mediaStreamType}-${this.stream.id}`;
        this.videoContainerId = this.componentId + '-videoContainer';
        this.state = {
            isSpeaking: false
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

        console.log('StreamMedia', this.stream, this.id);
        let renderer = new Renderer(this.stream);
        let view;
        let videoContainer;

        const renderStream = async () => {
            if(!view) {
                view = await renderer.createView();
            }
            videoContainer = document.getElementById(this.videoContainerId);
            if(!videoContainer?.hasChildNodes()) { videoContainer.appendChild(view.target); }
        }

        this.stream.on('isAvailableChanged', async () => {
            console.log(`stream=${this.stream.type}, isAvailableChanged=${this.stream.isAvailable}`);
            if (this.stream.isAvailable) {
                componentContainer.hidden = false;
                await renderStream();
            } else {
                componentContainer.hidden = true;

            }
        });

        if (this.stream.isAvailable) {
            componentContainer.hidden = false;
            await renderStream();
        }
    }

    render() {
        return (
            <div id={this.componentId} className="py-3 ms-Grid-col ms-lg4 ms-sm-12">
                <h4 className="video-title">{utils.getIdentifierText(this.remoteParticipant.identifier)}</h4>
                <div className={`w-100 ${this.state.isSpeaking ? `speaking-border-for-video` : ``}`} id={this.videoContainerId}></div>
            </div>
        );
    }
}



