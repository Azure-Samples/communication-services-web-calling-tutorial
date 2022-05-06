import React from "react";
export default class PreCallDiagnostics extends React.Component {
    render() {
        return (            
            <div>
                <fieldset>
                    <legend>Pre Call Diagnostics Results</legend>
                    <div className="flexContatiner">
                        <div className="flexItem">
                            <fieldset>
                                <legend>Device Access</legend>
                                <p> Audio: {this.props.preCallDiagnosticsResult.deviceAccess.audio}</p>
                                <p> Video: {this.props.preCallDiagnosticsResult.deviceAccess.video}</p>
                            </fieldset>
                            <fieldset>
                                <legend>Device Enumeration</legend>                            
                                <p>Microphone: {this.props.preCallDiagnosticsResult.deviceEnumeration.microphone}</p>
                                <p>Camera: {this.props.preCallDiagnosticsResult.deviceEnumeration.camera}</p>
                                <p>Speaker: {this.props.preCallDiagnosticsResult.deviceEnumeration.speaker}</p>
                            </fieldset>
                            <fieldset>
                                <legend>Call Diagnostics</legend>
                                <p>Connected: {this.props.preCallDiagnosticsResult.inCallDiagnostics.connected}</p>
                                <p>
                                    Diagnostics:
                                    <p>
                                        Audio:
                                            <p>Jitter: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.audio.jitter}</p>
                                            <p>Packets Loss: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.audio.packetLoss}</p>
                                            <p>RTT: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.audio.rtt}</p>
                                    </p>
                                    <p>
                                        Video: 
                                        <p>Jitter: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.video.jitter}</p>
                                            <p>Packets Loss: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.video.packetLoss}</p>
                                            <p>RTT: {this.props.preCallDiagnosticsResult.inCallDiagnostics.diagnostics.video.rtt}</p>
                                    </p>
                                </p>
                                <p>BandWidth: {this.props.preCallDiagnosticsResult.inCallDiagnostics.bandWidth}</p>
                            </fieldset>
                            <fieldset>
                                <legend>Browser Support</legend>
                                <p>Broswer: {this.props.preCallDiagnosticsResult.browserSupport.browser}</p>
                                <p>OS: {this.props.preCallDiagnosticsResult.browserSupport.os}</p>
                            </fieldset>
                        </div>
                    </div>
                </fieldset>
            </div>            
        );
    }
}