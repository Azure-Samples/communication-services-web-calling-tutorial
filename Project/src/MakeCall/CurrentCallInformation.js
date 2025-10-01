import React, { useState, useEffect } from "react";
import { Features } from "@azure/communication-calling";
import { AzureLogger } from '@azure/logger';

const CurrentCallInformation = ({ sentResolution, call }) => {
    const [ovcFeature, setOvcFeature] = useState();
    const [optimalVideoCount, setOptimalVideoCount] = useState(1);
    const [lastOvcChangeReason, setLastOvcChangeReason] = useState('Unknown');

    useEffect(() => {
        try {
            setOvcFeature(call.feature(Features.OptimalVideoCount));
        } catch (error) {
            AzureLogger.log("Feature not implemented yet");
        }

        return () => {
            ovcFeature?.off('optimalVideoCountChanged', optimalVideoCountChanged);
        }
    }, []);

    useEffect(() => {
        ovcFeature?.on('optimalVideoCountChanged', optimalVideoCountChanged);
    }, [ovcFeature]);

    const optimalVideoCountChanged = () => {
        setOptimalVideoCount(ovcFeature.optimalVideoCount);
        if (ovcFeature.lastOvcChangeReason) {
            setLastOvcChangeReason(ovcFeature.lastOvcChangeReason);
        }
    };

    return (
        <div className="ms-Grid-col ms-lg6 text-right">
            <div>Call Id: {call.id}</div>
            <div>Local Participant Id: {call.info.participantId}</div>
            {
                sentResolution && <div>Sent Resolution: {sentResolution}</div>
            }
            {
                ovcFeature && (
                    <>
                        <div>Optimal Video Count: {optimalVideoCount}</div>
                        <div>Last OVC Change Reason: {lastOvcChangeReason}</div>
                    </>
                )
            }           
        </div>
    );
}

export default CurrentCallInformation;
