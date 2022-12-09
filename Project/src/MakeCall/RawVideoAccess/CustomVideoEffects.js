import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react'
import cv from 'opencv-ts';
import { LocalVideoStream } from "@azure/communication-calling";

export default class CustomVideoEffects extends React.Component {

    constructor(props) {
        super(props);
        this.call = props.call;
        this.deviceManager = props.deviceManager;
        this.remoteVideoElementId = props.videoContainerId;
        this.remoteParticipantId = props.remoteParticipantId;
        this.isOutgoingVideoComponent = !props.remoteParticipantId;
        this.outgoingVideoBtnLabels = {
            add: "Set B&W effect on local video",
            remove: "Remove B&W effect on local video",
            sendDummy: "Send dummy local video"
        };
        this.incomingVideoBtnLabels = {
            add: "Set B/W effect on remote video",
            remove: "Remove effect on remote video",
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
        canvas.width = width;
        canvas.height = height;
        let cap = new cv.VideoCapture( videoElem);
        let src = new cv.Mat(height, width, cv.CV_8UC4);
        let dst = new cv.Mat(height, width, cv.CV_8UC1);
        

        const FPS = 30;
        function processVideo() {
            try {
                let begin = Date.now();
                // start processing.
                cap.read(src);
                cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
                cv.imshow(canvas, dst);
                // schedule the next one.
                let delay = Math.abs(1000/FPS - (Date.now() - begin));
                setTimeout(processVideo, delay);
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
            video.srcObject = mediaStream;
            video.play();
        }
    }

    dummyStream() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1280;
        canvas.height = 720;
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const colors = ['red', 'yellow', 'green'];
        window.setInterval(() => {
            if (ctx) {
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                const x = Math.floor(Math.random() * canvas.width);
                const y = Math.floor(Math.random() * canvas.height);
                const size = 100;
                ctx.fillRect(x, y, size, size);
            }
        }, 1000 / 30);

        return canvas.captureStream(30);
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
            case this.outgoingVideoBtnLabels.add:
                //add filters to outgoing video  
                const _addLocalVideoStream = this.call.localVideoStreams[0];
                const _localVideoStreamRawStream = await _addLocalVideoStream.getMediaStream();
                const bwStream = this.bwVideoStream(_localVideoStreamRawStream);
                if(bwStream) {
                    this.call.localVideoStreams[0].setMediaStream(bwStream);
                }
                break;
            case this.outgoingVideoBtnLabels.remove:
                //remove filters from outgoing video
                const _removeLocalVideoStream = this.call.localVideoStreams[0];
                await this.call.stopVideo(_removeLocalVideoStream);
                const cameras = await this.deviceManager.getCameras();
                const localVideoStream = new LocalVideoStream(cameras[0]);
                await this.call.startVideo(localVideoStream);
                break;
            case this.outgoingVideoBtnLabels.sendDummy:
                // send a dummy video
                const _dummyStream = this.dummyStream();
                if(_dummyStream) {
                    this.call.localVideoStreams[0].setMediaStream(_dummyStream);
                }
                break;
            case this.incomingVideoBtnLabels.add:
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
            case this.incomingVideoBtnLabels.remove:
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
                Object.keys(this.outgoingVideoBtnLabels).map((obj, idx) => {
                    return <PrimaryButton key={`${idx}-abcd`} className="primary-button mt-3" onClick={async (e) => this.addEffect(e)}>{this.outgoingVideoBtnLabels[obj]}</PrimaryButton>
                })
            :
                Object.keys(this.incomingVideoBtnLabels).map((obj, idx) => {
                    const dataProps = {
                        "data-videocontainerid": this.props.videoContainerId
                    };
                    for (const id in this.props.remoteParticipantId) {
                        dataProps[`data-${id.toLowerCase()}`] = this.props.remoteParticipantId[id];
                    }
                    return <PrimaryButton key={`${idx}-abcd`} 
                                          data-videocontainerid={this.props.videoContainerId}
                                          {...dataProps}
                                          className="primary-button mt-3" onClick={async (e) => this.addEffect(e)}>{this.incomingVideoBtnLabels[obj]}</PrimaryButton>
                })
    }

 

    render() {

        return(
            <div className="ms-Grid-row">
                {
                    this.renderElm()
                }
            </div>
        )
        
    }

}