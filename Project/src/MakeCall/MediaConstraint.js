import React from "react";
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';

export default class MediaConstraint extends React.Component {
    constructor(props) {
        super(props);
        this.videoSendHeightMax = [
            { key: 0, text: 'None' },
            { key: 180, text: '180' },
            { key: 240, text: '240' },
            { key: 360, text: '360' },
            { key: 540, text: '540' },
            { key: 720, text: '720' }
        ];
        this.state = {
            videoSendHeightMax: 0
        }
    }

    handleChange = async(event, item) => {
        let videoSendHeightMaxValue = item.key;
        this.setState({
            videoSendHeightMax: videoSendHeightMaxValue
        });
        if (this.props.onChange) {
            this.props.onChange({
                video: {
                    send: {
                        height: {
                            max: videoSendHeightMaxValue
                        }
                    }
                }
            });
        }
    }

    render() {
        return (
            <div>
                <Dropdown
                    ref={(ref) => this.videoSendHeightMaxDropdown = ref}
                    selectedKey={this.state.videoSendHeightMax}
                    onChange={this.handleChange}
                    label={'Video Constraint: Send Max Height Resolution'}
                    options={this.videoSendHeightMax}
                    styles={{ dropdown: { width: 200 }, label: { color: '#FFF'} }}
                    disabled={this.props.disabled}
                />
            </div>
        );
    }
}
