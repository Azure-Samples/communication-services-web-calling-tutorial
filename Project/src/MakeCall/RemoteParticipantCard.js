import React, { useEffect, createRef } from "react";
import { utils } from '../Utils/Utils';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import { Icon } from '@fluentui/react/lib/Icon';
import {
    isCommunicationUserIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier,
    isPhoneNumberIdentifier,
} from '@azure/communication-common';
import { Features } from '@azure/communication-calling';
import { ParticipantMenuOptions } from './ParticipantMenuOptions';

export default class RemoteParticipantCard extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.remoteParticipant = props.remoteParticipant;
        this.identifier = this.remoteParticipant.identifier;
        this.id = utils.getIdentifierText(this.remoteParticipant.identifier);
        this.isCheckable = isCommunicationUserIdentifier(this.remoteParticipant.identifier) ||
            isMicrosoftTeamsUserIdentifier(this.remoteParticipant.identifier);

        this.spotlightFeature = this.call.feature(Features.Spotlight);
        this.raiseHandFeature = this.call.feature(Features.RaiseHand);
        this.capabilitiesFeature = props.capabilitiesFeature;
        this.capabilities = this.capabilitiesFeature.capabilities;
        this.menuOptionsHandler= props.menuOptionsHandler;
        this.state = {
            isSpeaking: this.remoteParticipant.isSpeaking,
            state: this.remoteParticipant.state,
            isMuted: this.remoteParticipant.isMuted,
            hasDisplayNameChanged: this.remoteParticipant.hasDisplayNameChanged,
            displayName: this.remoteParticipant.hasDisplayNameChanged ? (this.remoteParticipant.displayName ? `${this.remoteParticipant.displayName.trim()} (Edited)` :  '') : this.remoteParticipant.displayName?.trim(),
            participantIds: this.remoteParticipant.endpointDetails.map((e) => { return e.participantId }),
            isHandRaised: utils.isParticipantHandRaised(this.remoteParticipant.identifier, this.raiseHandFeature.getRaisedHands()),
            isSpotlighted: utils.isParticipantHandRaised(this.remoteParticipant.identifier, this.spotlightFeature.getSpotlightedParticipants()),
            canManageLobby: this.capabilities.manageLobby?.isPresent || this.capabilities.manageLobby?.reason === 'FeatureNotSupported',
            canMuteOthers: this.capabilities.muteOthers?.isPresent || this.capabilities.muteOthers?.reason === 'FeatureNotSupported',
            forbidOthersAudio: this.capabilities.forbidOthersAudio?.isPresent || this.capabilities.forbidOthersAudio?.reason === 'FeatureNotSupported',
            forbidOthersVideo: this.capabilities.forbidOthersVideo?.isPresent || this.capabilities.forbidOthersVideo?.reason === 'FeatureNotSupported',
        };
    }

    componentWillUnmount() {
        this.remoteParticipant.off('isMutedChanged', () => {});
        this.remoteParticipant.off('stateChanged', () => {});
        this.remoteParticipant.off('isSpeakingChanged', () => {});
        this.remoteParticipant.off('displayNameChanged', () => {});
        this.spotlightFeature.off('spotlightChanged', ()=>{});
        this.raiseHandFeature.off("loweredHandEvent", ()=>{});
        this.raiseHandFeature.off("raisedHandEvent", ()=>{});
        if (this.props.onSelectionChanged) {
            this.props.onSelectionChanged(this.remoteParticipant.identifier, false);
        }
    }

    componentDidMount() {
        this.remoteParticipant.on('isMutedChanged', () => {
            this.setState({ isMuted: this.remoteParticipant.isMuted });
                if (this.remoteParticipant.isMuted) {
                    this.setState({ isSpeaking: false });
                }
        });

        this.remoteParticipant.on('stateChanged', () => {
            this.setState({ state: this.remoteParticipant.state });
        });

        this.remoteParticipant.on('isSpeakingChanged', () => {
            this.setState({ isSpeaking: this.remoteParticipant.isSpeaking });
        })

        this.remoteParticipant.on('displayNameChanged', ({newValue, oldValue, reason }) => {
            const hasDisplayNameChanged = this.remoteParticipant.hasDisplayNameChanged;
            const displayName = this.remoteParticipant.hasDisplayNameChanged ? (this.remoteParticipant.displayName ? `${this.remoteParticipant.displayName.trim()} (Edited)` :  '') : this.remoteParticipant.displayName?.trim();
            if (reason === 'editedDisplayName') {
                console.log('Edited display Name: ', newValue, oldValue, reason);
                this.setState({ hasDisplayNameChanged, displayName});
                this.menuOptionsHandler.handleDisplayNameChanged(newValue, oldValue, reason);
            } else {
                this.setState({displayName})
            }
        });

        this.spotlightFeature.on("spotlightChanged", () => {
            this.setState({isSpotlighted: utils.isParticipantSpotlighted(
                this.remoteParticipant.identifier, 
                this.spotlightFeature.getSpotlightedParticipants())});
        });

        const isRaiseHandChangedHandler = (event) => {
            this.setState({isHandRaised: utils.isParticipantHandRaised(
                this.remoteParticipant.identifier,
                this.raiseHandFeature.getRaisedHands())})
        }
        this.raiseHandFeature.on("loweredHandEvent", isRaiseHandChangedHandler);
        this.raiseHandFeature.on("raisedHandEvent", isRaiseHandChangedHandler);
        this.capabilitiesFeature.on('capabilitiesChanged', (capabilitiesChangeInfo) => {
            for (const [key, value] of Object.entries(capabilitiesChangeInfo.newValue)) {
                if(key === 'forbidOthersAudio' && value.reason != 'FeatureNotSupported') {
                    (value.isPresent) ? this.setState({ forbidOthersAudio: true }) : this.setState({ forbidOthersAudio: false });
                } else if(key === 'forbidOthersVideo' && value.reason != 'FeatureNotSupported') {
                    (value.isPresent) ? this.setState({ forbidOthersVideo: true }) : this.setState({ forbidOthersVideo: false });
                } else if(key === 'manageLobby' && value.reason != 'FeatureNotSupported') {
                    (value.isPresent) ? this.setState({ canManageLobby: true }) : this.setState({ canManageLobby: false });
                    let lobbyActions = document.getElementById('lobbyAction');
                    if (lobbyActions) {
                        if(this.state.canManageLobby === false){
                            lobbyActions.hidden = true;
                        }
                        else{
                            lobbyActions.hidden = false;
                        }
                    }
                    continue;
                }
            }
        });
    }

    handleRemoveParticipant(e, identifier) {
        e.preventDefault();
        this.call.removeParticipant(identifier).catch((e) => console.error(e))
    }

    handleMuteParticipant(e, remoteParticipant) {
        e.preventDefault();
        if (this.state.canMuteOthers) {
            remoteParticipant.mute().catch((e) => console.error('Failed to mute specific participant.', e.message, e));
        } else {
            console.error('Soft mute of remote participants is not a supported capability for this participant.');
        }
    }

    handleCheckboxChange(e) {
        this.props.onSelectionChanged(this.remoteParticipant.identifier, e.target.checked);
    }

    getMenuItems() {
        let menuItems = []
        menuItems.push({
            key: 'spotlight',
            iconProps: { iconName: 'Focus', className: this.state.isSpotlighted ? "callFeatureEnabled" : ``},
            text: this.state.isSpotlighted ? 'Stop Spotlight' : 'Start Spotlight',
            onClick: (e) => this.state.isSpotlighted ?
                this.menuOptionsHandler.stopSpotlight(this.identifier, e):
                this.menuOptionsHandler.startSpotlight(this.identifier, e)
        });
        if (this.props.mediaAccess && this.state.forbidOthersAudio && this.remoteParticipant.role === 'Attendee') {
            menuItems.push({
                key: 'forbidAudio',
                iconProps: { iconName: this.props.mediaAccess?.isAudioPermitted ? 'MicOff':'Microphone', className: this.props.mediaAccess?.isAudioPermitted ? `` : "callFeatureEnabled"},
                text: this.props.mediaAccess?.isAudioPermitted ? 'Disable mic' : 'Allow mic',
                onClick: (e) => this.props.mediaAccess?.isAudioPermitted ?
                    this.menuOptionsHandler.forbidAudio(this.identifier, e):
                    this.menuOptionsHandler.permitAudio(this.identifier, e)
            });
        }
        if (this.props.mediaAccess && this.state.forbidOthersVideo && this.remoteParticipant.role === 'Attendee') {
            menuItems.push({
                key: 'forbidVideo',
                iconProps: { iconName: this.props.mediaAccess?.isVideoPermitted ? 'VideoOff':'Video', className: this.props.mediaAccess?.isVideoPermitted ? `` : "callFeatureEnabled"},
                text: this.props.mediaAccess?.isVideoPermitted ? 'Disable camera' : 'Allow camera',
                onClick: (e) => this.props.mediaAccess?.isVideoPermitted ?
                    this.menuOptionsHandler.forbidVideo(this.identifier, e):
                    this.menuOptionsHandler.permitVideo(this.identifier, e)
            });
        }
        return menuItems.filter(item => item != 0)
    }

    getSecondaryText() {
        return `${this.state.state} | ${this.state.participantIds.toString()}`;
    }

    async handleRemoteRaiseHand() {
        try {
            if (this.state.isHandRaised) {
                await this.raiseHandFeature.lowerHands([this.remoteParticipant.identifier]);
                this.setState({isHandRaised: utils.isParticipantHandRaised(this.remoteParticipant.identifier, this.raiseHandFeature.getRaisedHands())})
            }
        } catch(error) {
            console.error(error)
        }
    }

    async admitParticipant() {
        console.log('admit');
        try {
            await this.call.lobby.admit(this.identifier);
        } catch (e) {
            console.error(e);
        }
    }

    async rejectParticipant() {
        console.log('reject');
        try {
            await this.call.lobby.reject(this.identifier);
        } catch (e) {
            console.error(e);
        }
    }

    render() {
        return (
            <li className={this.state.isSpotlighted ? 'participant-item spotlightEnabled':'participant-item'} key={utils.getIdentifierText(this.remoteParticipant.identifier)}>
                <div className="inline-flex align-items-center">
                    {
                        this.isCheckable &&
                        <div className="mr-3 inline-flex">
                            <input type="checkbox" onChange={e => this.handleCheckboxChange(e)} />
                        </div>
                    }
                    <div className="inline-flex">
                        <Persona className={this.state.isSpeaking ? `speaking-border-for-initials` : ``}
                            size={PersonaSize.size40}
                            text={ this.state.displayName ?
                                this.state.displayName :
                                this.state.participantIds.toString()
                            }
                            secondaryText={this.getSecondaryText()}
                            styles={{ primaryText: {color: '#edebe9'}, secondaryText: {color: '#edebe9'} }}/>
                    </div>
                </div>
                <div className="inline-flex align-items-center ml-3">
                    {
                        this.props.mediaAccess?.isVideoPermitted === false ? <div className="in-call-button inline-block"
                            title={`${this.state.isMuted ? 'Participant camera disabled': ``}`}
                            disabled={true}>
                                <Icon iconName={this.state.isMuted ? "VideoOff" : "Video"}/>
                        </div> : undefined
                    }
                    {
                        this.props.mediaAccess?.isAudioPermitted === false ? <div className="in-call-button inline-block"
                            title={`${this.state.isMuted ? 'Participant mic disabled': ``}`}
                            disabled={true}>
                                <Icon iconName={this.state.isMuted ? "MicOff" : "Microphone"}/>
                        </div> :  <div className="in-call-button inline-block"
                            title={`${this.state.isMuted ? 'Participant is muted': ``}`}
                            onClick={e => this.handleMuteParticipant(e, this.remoteParticipant)}>
                                <Icon iconName={this.state.isMuted ? "MicOff2" : "Microphone"}/>
                        </div>
                    }
                    {
                        !(isPhoneNumberIdentifier(this.remoteParticipant.identifier) || isUnknownIdentifier(this.remoteParticipant.identifier)) &&
                            <div className="in-call-button inline-block"
                                title={this.state.isHandRaised ? "Lower Participant Hand":``}
                                variant="secondary"
                                onClick={() => this.handleRemoteRaiseHand()}>
                                    <Icon iconName="HandsFree" className={this.state.isHandRaised ? "callFeatureEnabled" : ``}/>
                            </div>
                    }
                    <div className="inline-block">
                        <ParticipantMenuOptions
                            id={this.remoteParticipant.identifier}
                            appendMenuitems={this.getMenuItems()}
                            menuOptionsHandler={this.menuOptionsHandler}
                            menuOptionsState={{isSpotlighted: this.state.isSpotlighted}} />
                    </div>
                    <div className="inline-block">
                    {
                        this.state.state === "InLobby" ?
                            <div className="text-right lobby-action" id="lobbyAction" hidden={this.state.canManageLobby === false}>
                                <a href="#" onClick={e => this.admitParticipant(e)} className="float-right ml-3 green-link"> Admit</a>
                                <a href="#" onClick={e => this.rejectParticipant(e)} className="float-right ml-3 red-link"> Reject</a>
                            </div> :
                            <div className="in-call-button inline-block"
                                title={`Remove participant`}
                                variant="secondary"
                                onClick={(e) => this.handleRemoveParticipant(e, this.remoteParticipant.identifier)}>
                                <Icon iconName="UserRemove" />
                            </div>
                    }
                    </div>
                </div>
            </li>
        )
    }
}



