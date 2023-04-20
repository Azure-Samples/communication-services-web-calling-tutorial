import React, { useEffect, createRef } from "react";
import { utils } from '../Utils/Utils';
import { Persona, PersonaSize } from 'office-ui-fabric-react';
import { Icon } from '@fluentui/react/lib/Icon';
import { isCommunicationUserIdentifier, isMicrosoftTeamsUserIdentifier } from '@azure/communication-common';

export default class RemoteParticipantCard extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.remoteParticipant = props.remoteParticipant;
        this.id = utils.getIdentifierText(this.remoteParticipant.identifier);
        this.isCheckable = isCommunicationUserIdentifier(this.remoteParticipant.identifier) ||
            isMicrosoftTeamsUserIdentifier(this.remoteParticipant.identifier);

        this.state = {
            isSpeaking: this.remoteParticipant.isSpeaking,
            state: this.remoteParticipant.state,
            isMuted: this.remoteParticipant.isMuted,
            displayName: this.remoteParticipant.displayName?.trim()
        };
    }

    componentWillUnmount() {
        this.remoteParticipant.off('isMutedChanged', () => {});
        this.remoteParticipant.off('stateChanged', () => {});
        this.remoteParticipant.off('isSpeakingChanged', () => {});
        this.remoteParticipant.off('displayNameChanged', () => {});
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

        this.remoteParticipant.on('displayNameChanged', () => {
            this.setState({ displayName: this.remoteParticipant.displayName?.trim() });
        });
    }

    handleRemoveParticipant(e, identifier) {
        e.preventDefault();
        this.call.removeParticipant(identifier).catch((e) => console.error(e))
    }

    handleCheckboxChange(e) {
        this.props.onSelectionChanged(this.remoteParticipant.identifier, e.target.checked);
    }

    render() {
        return (
            <li className={`participant-item`} key={utils.getIdentifierText(this.remoteParticipant.identifier)}>
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg9 ms-sm8">
                    <Persona className={this.state.isSpeaking ? `speaking-border-for-initials` : ``}
                            size={PersonaSize.size40}
                            text={ this.state.displayName ? this.state.displayName : utils.getIdentifierText(this.remoteParticipant.identifier) }
                            secondaryText={this.state.state}
                            styles={{ primaryText: {color: '#edebe9'}, secondaryText: {color: '#edebe9'} }}/>
                    </div>
                    <div className="ms-Grid-col ms-lg1 ms-sm2">
                        {
                            this.state.isMuted &&
                            <Icon className="icon-text-large" iconName="MicOff2"/>
                        }
                        {
                            !this.state.isMuted &&
                            <Icon className="icon-text-large" iconName="Microphone"/>
                        }
                    </div>
                    <div className="ms-Grid-col ms-lg1 ms-sm2">
                    {
                        this.isCheckable &&
                        <input type="checkbox" onChange={e => this.handleCheckboxChange(e)} />
                    }
                    </div>
                </div>
                <div className="text-right">
                    <a href="#" onClick={e => this.handleRemoveParticipant(e, this.remoteParticipant.identifier)} className="participant-remove float-right ml-3">Remove participant</a>
                </div>
            </li>
        )
    }
}



