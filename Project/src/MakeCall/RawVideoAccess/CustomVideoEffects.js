import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react'
import { utils } from '../../Utils/Utils';

export default class CustomVideoEffects extends React.Component {

    constructor(props) {
        super(props);
        this.call = props.call;
        this.stream = props.stream;
        this.bwStream = undefined;
        this.bwVideoelem = undefined;
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

        if (props.outgoingVideoBtns) {
            this.state = {
                outgoingVideoBtns: props.outgoingVideoBtns
            };
        } else {
            this.state = {
                outgoingVideoBtns: {
                    add: {
                        label: "Set B/W effect on local video", 
                        disabled: false
                    },
                    sendDummy: {
                        label: "Send dummy local video", 
                        disabled: false
                    }
                }
            };
        };
    }

    componentWillUnmount() {
        if (this.bwVideoElem) {
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
                const { bwStream, bwVideoElem } = utils.bwVideoStream(_localVideoStreamRawStream);
                this.bwStream = bwStream;
                this.bwVideoElem = bwVideoElem;
                if(bwStream) {
                    this.state.outgoingVideoBtns.add.disabled = true;
                    this.stream.setMediaStream(bwStream);
                }
                break;
            case this.state.outgoingVideoBtns.sendDummy?.label:
                // send a dummy video
                const _dummyStream = utils.dummyStream();
                if(_dummyStream) {
                    this.stream.setMediaStream(_dummyStream);
                }
                break;
            case this.incomingVideoBtns.add?.label:
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