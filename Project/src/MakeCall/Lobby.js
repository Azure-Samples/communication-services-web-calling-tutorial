import React from "react";
import { PrimaryButton } from 'office-ui-fabric-react';
import { Features } from '@azure/communication-calling';

// Lobby react function component
export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.lobby = this.call.lobby;
        
        this.capabilitiesFeature = this.call.feature(Features.Capabilities);
        this.capabilities = this.capabilitiesFeature.capabilities;
        this.state = {
            canManageLobby: this.capabilities.manageLobby?.isPresent || this.capabilities.manageLobby?.reason === 'FeatureNotSupported',
            lobbyParticipantsCount: this.lobby.participants.length
        };
    }

    componentWillUnmount() {
        this.lobby?.off('lobbyParticipantsUpdated', () => { });
    }

    componentDidMount() {
        this.lobby?.on('lobbyParticipantsUpdated', this.lobbyParticipantsUpdatedHandler);
        this.capabilitiesFeature.on('capabilitiesChanged', this.capabilitiesChangedHandler);
    }

    lobbyParticipantsUpdatedHandler = (event) => {
        console.log(`lobbyParticipantsUpdated, added=${event.added}, removed=${event.removed}`);
        this.state.lobbyParticipantsCount = this.lobby?.participants.length;
        if(event.added.length > 0) {
            event.added.forEach(participant => {
                console.log('lobbyParticipantAdded', participant);
            });
        }
        if(event.removed.length > 0) {
            event.removed.forEach(participant => {
                console.log('lobbyParticipantRemoved', participant);
            });
        }
    };

    capabilitiesChangedHandler = (capabilitiesChangeInfo) => {
        console.log('lobby:capabilitiesChanged');
        for (const [key, value] of Object.entries(capabilitiesChangeInfo.newValue)) {
            if(key === 'manageLobby' && value.reason != 'FeatureNotSupported') {
                (value.isPresent) ? this.setState({ canManageLobby: true }) : this.setState({ canManageLobby: false });
                const admitAllButton = document.getElementById('admitAllButton');
                if(this.state.canManageLobby === true){
                    admitAllButton.style.display = '';
                } else {
                    admitAllButton.style.display = 'none';
                }
                continue;
            }
        }
    };

    async admitAllParticipants() {
        console.log('admitAllParticipants');
        try {
            await this.lobby?.admitAll();
        } catch (e) {
            console.error(e);
        }
    }

    render() {
        return (
            <div>
                {
                    (this.state.lobbyParticipantsCount > 0) &&
                    <div className="ms-Grid-row">
                        <div className="ml-2 inline-block">
                            <div>In-Lobby participants number: {this.state.lobbyParticipantsCount}</div>
                        </div>
                        <div className="ml-4 inline-block">
                            <PrimaryButton className="primary-button"
                                            id="admitAllButton"
                                            style={{ display: this.state.canManageLobby ? '' : 'none' }}
                                            iconProps={{ iconName: 'Group', style: { verticalAlign: 'middle', fontSize: 'large' } }}
                                            text="Admit All Participants"
                                            onClick={() => this.admitAllParticipants()}>
                            </PrimaryButton>
                        </div>
                    </div>
                }
            </div>
        );
    }
}
