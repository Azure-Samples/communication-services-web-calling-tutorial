import React, { useState, useEffect } from "react";
import { Features } from "@azure/communication-calling";
const CurrentCallInformation = ({ callId, sentResolution, call }) => {
    const [ovcFeature, setOvcFeature] = useState();
    const [optimalVideoCount, setOptimalVideoCount] = useState(1);

    useEffect(() => {
        try {
            setOvcFeature(call.feature(Features.OptimalVideoCount));
        } catch (error) {
            console.error("Feature not implemented yet");
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
    };

    return (
        <div className="ms-Grid-col ms-lg6 text-right">
            <p>Call Id: {callId}</p>
            <p>Sent Resolution: {sentResolution}</p>
            <p>Optimal Video Count: {optimalVideoCount}</p>
        </div>
    );
}

export default CurrentCallInformation;
