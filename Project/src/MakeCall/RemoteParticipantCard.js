import React, { useEffect, createRef } from "react";
import { utils } from '../Utils/Utils';
import { Persona, PersonaSize } from 'office-ui-fabric-react';
import { Icon } from '@fluentui/react/lib/Icon';

export default class RemoteParticipantCard extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.remoteParticipant = props.remoteParticipant;
        this.id = utils.getIdentifierText(this.remoteParticipant.identifier);

        this.state = {
            isSpeaking: this.remoteParticipant.isSpeaking,
            state: this.remoteParticipant.state,
            isMuted: this.remoteParticipant.isMuted
        };
    }

    async componentWillMount() {
        this.remoteParticipant.on('isMutedChanged', () => {
            this.setState({ isMuted: this.remoteParticipant.isMuted })
        });

        this.remoteParticipant.on('participantStateChanged', () => {
            this.setState({ state: this.remoteParticipant.state })
        });

        this.remoteParticipant.on('isSpeakingChanged', () => {
            this.setState({ isSpeaking: this.remoteParticipant.isSpeaking });
        })
    }

    handleRemoveParticipant(e, identifier) {
        e.preventDefault();
        this.call.removeParticipant(identifier).catch((e) => console.error(e))
    }

    render() {
        return (
            <li className={`participant-item`} action key={utils.getIdentifierText(this.remoteParticipant.identifier)}>
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg11">
                    <Persona className={this.state.isSpeaking ? `speaking-border-for-initials` : ``}
                            size={PersonaSize.size40}
                            text={ utils.getIdentifierText(this.remoteParticipant.identifier) }
                            secondaryText={this.state.state}
                            styles={{ primaryText: {color: '#edebe9'}, secondaryText: {color: '#edebe9'} }}/>
                    </div>
                    <div className="ms-Grid-col ms-lg1">
                        {
                            this.state.isMuted &&
                            <Icon className="icon-text-large" iconName="MicOff2"/>
                        }
                        {
                            !this.state.isMuted &&
                            <Icon className="icon-text-large" iconName="Microphone"/>
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



