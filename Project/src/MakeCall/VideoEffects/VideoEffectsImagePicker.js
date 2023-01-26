import React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';

export default class VideoEffectsImagePicker extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            images: [
                {
                    location: '../assets/images/ACSBackdrop.png',
                    name: 'ACSBackdrop'
                },
                {
                    location: '../assets/images/MicrosoftLearnBackdrop.png',
                    name: 'MicrosoftLearnBackdrop'
                }
            ],
            selectedImage: {
                location: '',
                name: ''
            }
        }
    }

    handleImageClick(image) {
        const selectedImage = this.state.images.find(item => item.name === image.name );

        if (selectedImage) {
            this.setState({
                ...this.state,
                selectedImage
            });

            if (this.props.handleImageClick) {
                this.props.handleImageClick(selectedImage.location);
            }
        }
    }

    render() {
        return (
            <div className={`ms-Grid-row video-effects-image-picker ${this.props.disabled && 'disabled'}`} id='video-effects-image-picker'>
                {this.state.images.map(image => (
                    <div className='image-container'>
                        <img 
                            className={`background-image-sample ${this.state.selectedImage.name === image.name ? 'selected' : ''}`}
                            src={image.location}
                            alt={image.name}
                            onClick={() => this.handleImageClick(image)}
                        />
                        <Icon iconName='SkypeCheck' className={`image-overlay-icon ${this.state.selectedImage.name === image.name ? 'show' : 'hide'}`} />
                    </div>
                ))
                }
            </div>
        );
    }
}
