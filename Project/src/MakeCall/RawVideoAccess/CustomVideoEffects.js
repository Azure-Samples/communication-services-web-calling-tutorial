import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react'

export default class CustomVideoEffects extends React.Component {

    constructor(props) {
        super(props);
        this.call = props.call;
        this.stream = props.stream;
        this.bwStream = undefined;
        this.bwVideoelem = undefined;
        this.bwTimeout = undefined;
        this.bwCtx = undefined;
        this.dummyTimeout = undefined;
        this.remoteVideoElementId = props.videoContainerId;
        this.remoteParticipantId = props.remoteParticipantId;
        this.isOutgoingVideoComponent = !props.remoteParticipantId;
        this.incomingVideoBtns = {
            add: {
                label: "Set B/W effect on remote video", 
                disabled: false
            },
            remove: {
                label: "Remove effect on remote video", 
                disabled: false
            }
        };

        this.state = {
            outgoingVideoBtns: props.outgoingVideoBtns ? props.outgoingVideoBtns : undefined 
        };
    }

    componentWillUnmount() {
        if (this.dummyTimeout) {
            clearTimeout(this.dummyTimeout);
        }

        if (this.bwVideoElem) {
            this.bwCtx.clearRect(0, 0, this.bwVideoElem.width, this.bwVideoElem.height);
            clearTimeout(this.bwTimeout);
            this.bwVideoElem.srcObject.getVideoTracks().forEach((track) => { track.stop(); });
            this.bwVideoElem.srcObject = null;
        }
    }

    setSourceObject(mediaStream, videoContainerId) {
        const target = document.getElementById(videoContainerId)
        const video = target.querySelector("video");
        if(video) {
            try {
                video.srcObject = mediaStream;
                video.load();
            } catch(err) {
                console.error('There was an issue setting the source', err);
            }   
        }
    }

    async addEffect(e) {
        const identifierTable = {
            communicationUser: ["communicationUserId"],
            phoneNumber: ["rawId", "phoneNumber"],
            microsoftTeamsUser: ["rawId", "microsoftTeamsUserId", "isAnonymous", "cloud"],
            unknown: ["id"],
            videocontainerid: e.currentTarget.dataset.videocontainerid

        };
        switch (e.currentTarget.children[0].textContent) {
            case this.state.outgoingVideoBtns.add?.label:
                //add filters to outgoing video  
                const _localVideoStreamRawStream = await this.stream.getMediaStream();
                const { bwStream, bwVideoElem } = this.bwVideoStream(_localVideoStreamRawStream);
                this.bwStream = bwStream;
                this.bwVideoElem = bwVideoElem;
                if(bwStream) {
                    this.stream.setMediaStream(bwStream);
                }
                this.setState({ outgoingVideoBtns: {
                    add: {
                        label: "Set B/W effect",
                        disabled: true
                    },
                    sendDummy: {
                        label: "Set dummy effect", 
                        disabled: true
                    }
                }});
                break;
            case this.state.outgoingVideoBtns.sendDummy?.label:
                // send a dummy video
                const _dummyStream = this.dummyStream();
                if(_dummyStream) {
                    this.stream.setMediaStream(_dummyStream);
                }
                this.setState({ outgoingVideoBtns: {
                    add: {
                        label: "Set B/W effect",
                        disabled: true
                    },
                    sendDummy: {
                        label: "Set dummy effect", 
                        disabled: true
                    }
                }});
                break;
            case this.incomingVideoBtns.add?.label:
                //add filters to incoming video
                this.call.remoteParticipants.forEach((participant) => {
                    identifierTable[participant.identifier.kind].forEach(async (prop) => {
                        if(participant.identifier[prop] === e.currentTarget.dataset[prop.toLowerCase()]) {
                            const _addRemoteVideoStream = await participant.videoStreams[0].getMediaStream();
                            const { bwStream, bwVideoElem } = this.bwVideoStream(_addRemoteVideoStream);
                            if(bwStream) {
                                //render the filtered video
                                this.setSourceObject(bwStream, identifierTable.videocontainerid);
                            }
                        }
                    })
                });
                break;
            case this.incomingVideoBtns.remove?.label:
                //remove filters from incoming video
                this.call.remoteParticipants.forEach((participant) => {
                    identifierTable[participant.identifier.kind].forEach(async (prop) => {
                        if(participant.identifier[prop] === e.currentTarget.dataset[prop.toLowerCase()]) {
                            const _removeRemoteVideoStream = await participant.videoStreams[0].getMediaStream();
                            if(_removeRemoteVideoStream) {
                                //render original unfiltered video
                                this.setSourceObject(_removeRemoteVideoStream, identifierTable.videocontainerid);
                            }
                        }
                    })
                });
                break;
        }
    }

    bwVideoStream(stream) {
        let width = 1280, height = 720;
        const bwVideoElem = document.createElement("video");
        bwVideoElem.srcObject = stream;
        bwVideoElem.height = height;
        bwVideoElem.width = width;
        bwVideoElem.play();
        const canvas = document.createElement('canvas');
        this.bwCtx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = width;
        canvas.height = height;

        const FPS = 30;
        const processVideo = function () {
            try {
                let begin = Date.now();
                // start processing.
                this.bwCtx.filter = "grayscale(1)";
                this.bwCtx.drawImage(bwVideoElem, 0, 0, width, height);
                const imageData = this.bwCtx.getImageData(0, 0, width, height);
                this.bwCtx.putImageData(imageData, 0, 0);
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                this.bwTimeout = setTimeout(processVideo, delay);
            } catch (err) {
                console.error(err);
            }
        }.bind(this);

        // schedule the first one.
        this.bwTimeout = setTimeout(processVideo, 0);
        const bwStream = canvas.captureStream(FPS);
        return { bwStream, bwVideoElem };
    }

    dummyStream() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        canvas.width = 1280;
        canvas.height = 720;
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const colors = ['red', 'yellow', 'green'];
        const FPS = 30;
        function createShapes() {
            try {
                let begin = Date.now();
                // start processing.
                if (ctx) {
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    const x = Math.floor(Math.random() * canvas.width);
                    const y = Math.floor(Math.random() * canvas.height);
                    const size = 100;
                    ctx.fillRect(x, y, size, size);
                }            
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                this.dummyTimeout = setTimeout(createShapes, delay);
            } catch (err) {
                console.error(err);
            }
        };

        // schedule the first one.
        this.dummyTimeout = setTimeout(createShapes, 0);
        return canvas.captureStream(FPS);
    }

    renderElm() {
        return this.isOutgoingVideoComponent 
            ?
                this.state.outgoingVideoBtns &&
                Object.keys(this.state.outgoingVideoBtns).map((obj, idx) => {
                    return <div>
                                <PrimaryButton 
                                    key={`${idx}-abcd`} 
                                    className="primary-button" 
                                    onClick={async (e) => this.addEffect(e)}
                                    disabled={this.state.outgoingVideoBtns[obj].disabled}>
                                        {this.state.outgoingVideoBtns[obj].label}
                                </PrimaryButton>
                            </div>
                })
            :
                Object.keys(this.incomingVideoBtns).map((obj, idx) => {
                    const dataProps = {
                        "data-videocontainerid": this.props.videoContainerId
                    };
                    for (const id in this.props.remoteParticipantId) {
                        dataProps[`data-${id.toLowerCase()}`] = this.props.remoteParticipantId[id];
                    }
                    return <PrimaryButton 
                                key={`${idx}-abcdefg`} 
                                data-videocontainerid={this.props.videoContainerId}
                                {...dataProps}
                                className="primary-button mt-3" onClick={async (e) => this.addEffect(e)}
                                disabled={this.incomingVideoBtns[obj].disabled}>
                                    {this.incomingVideoBtns[obj].label}
                            </PrimaryButton>
                })
    }

 

    render() {

        return(
            <div className={`custom-video-effects-buttons ${this.isOutgoingVideoComponent ? 'outgoing' : 'incoming'}`}>
                {
                    this.renderElm()
                }
            </div>
        )
        
    }

}