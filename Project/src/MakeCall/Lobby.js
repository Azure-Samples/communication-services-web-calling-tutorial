import React, { useEffect, useState } from "react";
import { PrimaryButton } from 'office-ui-fabric-react';

// Lobby react function component
const Lobby = ({ call }) => {
    const [lobby, setLobby] = useState(call.lobby);
    const [lobbyParticipantNames, setLobbyParticipantNames] = useState([]);

    useEffect(() => {
        return () => {
            lobby?.off('lobbyParticipantsUpdated', lobbyParticipantsUpdatedHandler);
        }
    }, []);

    useEffect(() => {
        lobby?.on('lobbyParticipantsUpdated', lobbyParticipantsUpdatedHandler);
    }, [lobby]);

    const lobbyParticipantsUpdatedHandler = (event) => {
        console.log(`lobbyParticipantsUpdated, added=${event.added}, removed=${event.removed}`);
        if(event.added.length > 0) {
            console.log('lobbyParticipantAdded');
            setLobbyParticipantNames(lobby.participants.map(remoteParticipant => remoteParticipant.displayName));
        }
        if(event.removed.length > 0) {
            console.log('participantRemoved');
            setLobbyParticipantNames(lobby.participants.map(remoteParticipant => remoteParticipant.displayName));
        }
    };

    const admitAllParticipants = async () => {
        console.log('admitAllParticipants');
        try {
            await lobby.admitAll();
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="ms-Grid-row">
            <div className="ms-Grid-row">
                <PrimaryButton className="primary-button"
                                iconProps={{ iconName: 'Group', style: { verticalAlign: 'middle', fontSize: 'large' } }}
                                text="Admit All Participants"
                                onClick={admitAllParticipants}>
                </PrimaryButton>
            </div>
            <div className="ms-Grid-row">
                <h3>In-Lobby participants list:</h3>
                <ul>
                    {lobbyParticipantNames.map((participantName, index) => (
                        <li key={index}>{participantName}</li>
                    ))}
                </ul>
            </div>      
        </div>
    );
};

export default Lobby;
