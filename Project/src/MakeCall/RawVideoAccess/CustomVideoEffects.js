import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react'
import { LocalVideoStream } from "@azure/communication-calling";

export default class CustomVideoEffects extends React.Component {

    constructor(props) {
        super(props);
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.remoteVideoElementId = props.videoContainerId;
        this.remoteParticipantId = props.remoteParticipantId;
        this.isOutgoingVideoComponent = !props.remoteParticipantId;
        this.outgoingVideoBtns = {
            add: {
                label: "Set B/W effect on local video", 
                disabled: false
            },
            remove: {
                label: "Remove effect on local video", 
                disabled: true
            },
            sendDummy: {
                label: "Send dummy local video", 
                disabled: false
            }
        };
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
    }

    bwVideoStream(currentStream) { 
        let width = 1280, height = 720;
        const videoElem = document.createElement("video");
        videoElem.srcObject = currentStream;
        videoElem.height = height;
        videoElem.width = width;
        videoElem.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        canvas.width = width;
        canvas.height = height;
        

        const FPS = 30;
        function processVideo() {
            try {
                let begin = Date.now();
                // start processing.
                ctx.filter = "grayscale(1)";
                ctx.drawImage(videoElem, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                ctx.putImageData(imageData, 0, 0);              
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                setTimeout(processVideo, delay)
                ;
            } catch (err) {
                console.error(err);
            }
        };

        // schedule the first one.
        setTimeout(processVideo, 0);
        return canvas.captureStream(FPS);
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
                setTimeout(createShapes, delay);
            } catch (err) {
                console.error(err);
            }
        };

        // schedule the first one.
        setTimeout(createShapes, 0);
        return canvas.captureStream(FPS);
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
            case this.outgoingVideoBtns.add.label:
                //add filters to outgoing video  
                const _addLocalVideoStream = this.call.localVideoStreams[0];
                const _localVideoStreamRawStream = await _addLocalVideoStream.getMediaStream();
                const bwStream = this.bwVideoStream(_localVideoStreamRawStream);
                if(bwStream) {
                    this.outgoingVideoBtns.add.disabled = true;
                    this.outgoingVideoBtns.remove.disabled = false;
                    this.call.localVideoStreams[0].setMediaStream(bwStream);
                }
                break;
            case this.outgoingVideoBtns.remove.label:
                //remove filters from outgoing video
                const cameras = await this.deviceManager.getCameras();
                const localVideoStream = new LocalVideoStream(cameras[0]);
                const mediaStream = await localVideoStream.getMediaStream();
                this.call.localVideoStreams[0].setMediaStream(mediaStream);
                this.outgoingVideoBtns.add.disabled = false;
                this.outgoingVideoBtns.remove.disabled = true;
                break;
            case this.outgoingVideoBtns.sendDummy.label:
                // send a dummy video
                const _dummyStream = this.dummyStream();
                if(_dummyStream) {
                    this.call.localVideoStreams[0].setMediaStream(_dummyStream);
                    this.outgoingVideoBtns.remove.disabled = false;
                }
                break;
            case this.incomingVideoBtns.add.label:
                //add filters to incoming video
                this.call.remoteParticipants.forEach((participant) => {
                    identifierTable[participant.identifier.kind].forEach(async (prop) => {
                        if(participant.identifier[prop] === e.currentTarget.dataset[prop.toLowerCase()]) {
                            const _addRemoteVideoStream = await participant.videoStreams[0].getMediaStream();
                            const bwRemoteStream = this.bwVideoStream(_addRemoteVideoStream);
                            if(bwRemoteStream) {
                                //render the filtered video
                                this.setSourceObject(bwRemoteStream, identifierTable.videocontainerid);
                            }
                        }
                    })
                });
                break;
            case this.incomingVideoBtns.remove.label:
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

    renderElm() {
        return this.isOutgoingVideoComponent 
            ?
                Object.keys(this.outgoingVideoBtns).map((obj, idx) => {
                    return <PrimaryButton 
                                key={`${idx}-abcd`} 
                                className="primary-button mt-3" 
                                onClick={async (e) => this.addEffect(e)}
                                disabled={this.outgoingVideoBtns[obj].disabled}>
                                    {this.outgoingVideoBtns[obj].label}
                            </PrimaryButton>
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
                                key={`${idx}-abcd`} 
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