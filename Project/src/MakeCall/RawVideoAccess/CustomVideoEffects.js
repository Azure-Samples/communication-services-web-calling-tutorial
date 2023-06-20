import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react'
import { LocalVideoStream } from "@azure/communication-calling";
import { utils } from '../../Utils/Utils';

export default class CustomVideoEffects extends React.Component {

    constructor(props) {
        super(props);
        this.call = props.call;
        this.stream = props.stream;
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
            case this.outgoingVideoBtns.add.label:
                //add filters to outgoing video  
                const _localVideoStreamRawStream = await this.stream.getMediaStream();
                const bwStream = utils.bwVideoStream(_localVideoStreamRawStream);
                if(bwStream) {
                    this.outgoingVideoBtns.add.disabled = true;
                    this.outgoingVideoBtns.remove.disabled = false;
                    this.stream.setMediaStream(bwStream);
                }
                break;
            case this.outgoingVideoBtns.remove.label:
                //remove filters from outgoing video
                const cameras = await this.deviceManager.getCameras();
                const localVideoStream = new LocalVideoStream(cameras[0]);
                const mediaStream = await localVideoStream.getMediaStream();
                this.stream.setMediaStream(mediaStream);
                this.outgoingVideoBtns.add.disabled = false;
                this.outgoingVideoBtns.remove.disabled = true;
                break;
            case this.outgoingVideoBtns.sendDummy.label:
                // send a dummy video
                const _dummyStream = utils.dummyStream();
                if(_dummyStream) {
                    this.stream.setMediaStream(_dummyStream);
                    this.outgoingVideoBtns.remove.disabled = false;
                }
                break;
            case this.incomingVideoBtns.add.label:
                //add filters to incoming video
                this.call.remoteParticipants.forEach((participant) => {
                    identifierTable[participant.identifier.kind].forEach(async (prop) => {
                        if(participant.identifier[prop] === e.currentTarget.dataset[prop.toLowerCase()]) {
                            const _addRemoteVideoStream = await participant.videoStreams[0].getMediaStream();
                            const bwRemoteStream = utils.bwVideoStream(_addRemoteVideoStream);
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
                    return <div>
                                <PrimaryButton 
                                    key={`${idx}-abcd`} 
                                    className="primary-button" 
                                    onClick={async (e) => this.addEffect(e)}
                                    disabled={this.outgoingVideoBtns[obj].disabled}>
                                        {this.outgoingVideoBtns[obj].label}
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