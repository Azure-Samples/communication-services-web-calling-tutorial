import React, { useState, useRef } from "react";
import { Button, TextField } from 'office-ui-fabric-react';
import { Features } from '@azure/communication-calling';


export default function AddParticipantPopover(props) {
    const [userId, setUserId] = useState('');
    const [alternateCallerId, setAlternateCallerId] = useState('');
    const [showAddParticipantPanel, setShowAddParticipantPanel] = useState(false);
    const [role, setRole] = useState(props.call.role);
    const [totalParticipants, setTotalParticipants] = useState(props.call.totalParticipantCount);
    const [streamingClients, setStreamingClients] = useState(props.call.feature(Features.LiveStream).participantCount);

    props.call.on('roleChanged', () => {
        setRole(props.call.role);
    });

    props.call.on('totalParticipantCountChanged', () => {
        setTotalParticipants(props.call.totalParticipantCount);
    });

    props.call.feature(Features.LiveStream).on('participantCountChanged', () => {
        setStreamingClients(props.call.feature(Features.LiveStream).participantCount);
    });

    function handleAddCommunicationUser() {
        console.log('handleAddCommunicationUser', userId);
        try {
            props.call.addParticipant({ communicationUserId: userId });
        } catch (e) {
            console.error(e);
        }
    }

    function handleAddPhoneNumber() {
        console.log('handleAddPhoneNumber', userId);
        try {
            props.call.addParticipant({ phoneNumber: userId }, { alternateCallerId: { phoneNumber: alternateCallerId }});
        } catch (e) {
            console.error(e);
        }
    }

    function toggleAddParticipantPanel() {
        setShowAddParticipantPanel(!showAddParticipantPanel);
    }

    return (
        <>
        <span>
            <h3>Participants</h3>
            <h4>Role: {role}</h4>
            <h4>Total Participants: {totalParticipants}, Streaming Clients: {streamingClients}</h4>
        </span>
        <span><a href="#" onClick={toggleAddParticipantPanel}><i className="add-participant-button ms-Icon ms-Icon--AddFriend" aria-hidden="true"></i></a></span>
        <div className="ms-Grid">
            <div className="ms-Grid-row">
                <div className="ms-Grid-col ms-lg12">
                    {
                        showAddParticipantPanel &&
                        <div className="add-participant-panel">
                            <h3 className="add-participant-panel-header">Add a participant</h3>
                            <div className="add-participant-panel-header">
                                <TextField className="text-left" label="Identifier" onChange={e => setUserId(e.target.value)} />
                                <TextField className="text-left" label="Alternate Caller Id (For adding phone number only)" onChange={e => setAlternateCallerId(e.target.value)} />
                                <Button className="mt-3" onClick={handleAddCommunicationUser}>Add CommunicationUser</Button>
                                <Button className="mt-1" onClick={handleAddPhoneNumber}>Add Phone Number</Button>
                            </div>
                        </div>
                    }
                </div>
            </div>
        </div>
        </>
    );
}