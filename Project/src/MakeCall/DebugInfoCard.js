import React from "react";
export default class DebugInfoCard extends React.Component {
    render() {
        return (            
            <div>
                <fieldset>
                    <div className='content'>
                        <div className='box'>
                            <legend>Call debug info</legend>
                            <div className="callDebugInfoJSONStringDiv">
                                <pre>{this.props.debugInfo}</pre>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </div>            
        );
    }
}