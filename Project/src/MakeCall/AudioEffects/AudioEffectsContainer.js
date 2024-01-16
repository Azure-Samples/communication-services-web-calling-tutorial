import React from 'react';
import { Features } from '@azure/communication-calling';
import { 
    EchoCancellationEffect,
    NoiseSuppressionEffect,
    DeepNoiseSuppressionEffect
} from '@azure/communication-calling-effects';
import { Dropdown, PrimaryButton } from '@fluentui/react';

export const LoadingSpinner = () => {
    return (
        <div className='audio-effects-loading-spinner'></div>
    );
};

export default class AudioEffectsContainer extends React.Component {
    constructor(props) {
        super(props);
        this.call = props.call;
        this.localAudioStreamFeatureApi = null;

        this.state = {
            selectedAudioEffect: null,
            supportedAudioEffects: [],
            supportedAudioEffectsPopulated: false,
            autoGainControlList: [],
            echoCancellationList: [],
            noiseSuppressionList: [],
            startEffectsLoading: false,
            stopEffectsLoading: false
        };

        this.initLocalAudioStreamFeatureApi();
    }

    componentDidCatch(e) {
        this.logError(JSON.stringify(e));
    }

    componentDidMount() {
        this.populateAudioEffects();
    }

    logError(error) {
        this.setState({
            ...this.state
        });

        console.error(error);
    }

    initLocalAudioStreamFeatureApi() {
        const localAudioStream = this.call.localAudioStreams.find(a => {
            return a.mediaStreamType === 'Audio';
        });

        console.log('call las::');
        console.log(this.call);

        if (!localAudioStream) {
            this.logError('No local audio streams found.');
            return;
        }

        const lasFeatureApi = localAudioStream.feature && localAudioStream.feature(Features?.AudioEffects);
        if (!lasFeatureApi) {
            this.logError('Could not get local audio stream feature API.');
            return;
        }
        this.localAudioStreamFeatureApi = lasFeatureApi;

        this.localAudioStreamFeatureApi.on('effectsError', (error) => {
            this.logError(JSON.stringify(error));
            this.setState({
                ...this.state,
                startEffectsLoading: false,
                stopEffectsLoading: false
            });
        });

        this.localAudioStreamFeatureApi.on('effectsStarted', (error) => {
            this.setState({
                ...this.state,
                startEffectsLoading: false
            });
        });

        this.localAudioStreamFeatureApi.on('effectsStopped', (error) => {
            this.setState({
                ...this.state,
                stopEffectsLoading: false
            });
        });
    }

    async populateAudioEffects() {
        const supported = [];
        const autoGainControlList = [];
        const echoCancellationList = [];
        const noiseSuppressionList = [];

        if (this.localAudioStreamFeatureApi) {
            if (await this.localAudioStreamFeatureApi.isSupported('BrowserAutoGainControl')) {
                supported.push('BrowserAutoGainControl');
                autoGainControlList.push({
                    key: 'BrowserAutoGainControl',
                    text: 'Browser Auto Gain Control'
                });
            }

            if (await this.localAudioStreamFeatureApi.isSupported('BrowserEchoCancellation')) {
                supported.push('BrowserEchoCancellation');
                echoCancellationList.push({
                    key: 'BrowserEchoCancellation',
                    text: 'Browser Echo Cancellation'
                });
            }

            if (await this.localAudioStreamFeatureApi.isSupported('BrowserNoiseSuppression')) {
                supported.push('BrowserNoiseSuppression');
                noiseSuppressionList.push({
                    key: 'BrowserNoiseSuppression',
                    text: 'Browser Noise Suppression'
                });
            }

            const echoCancellation = new EchoCancellationEffect();
            if (await this.localAudioStreamFeatureApi.isSupported(echoCancellation)) {
                supported.push(echoCancellation);
                echoCancellationList.push({
                    key: echoCancellation.name,
                    text: 'Echo Cancellation'
                });
            }

            const noiseSuppression = new NoiseSuppressionEffect();
            if (await this.localAudioStreamFeatureApi.isSupported(noiseSuppression)) {
                supported.push(noiseSuppression);
                noiseSuppressionList.push({
                    key: noiseSuppression.name,
                    text: 'Noise Suppression'
                });
            }

            const deepNoiseSuppression = new DeepNoiseSuppressionEffect();
            if (await this.localAudioStreamFeatureApi.isSupported(deepNoiseSuppression)) {
                supported.push(deepNoiseSuppression);
                noiseSuppressionList.push({
                    key: deepNoiseSuppression.name,
                    text: 'Deep Noise Suppression'
                });
            }

            this.setState({
                ...this.state,
                supportedAudioEffects: [ ...supported ],
                supportedAudioEffectsPopulated: true,
                selectedAudioEffect: typeof supported[0] === 'string' ? supported[0] : supported[0].name,
                autoGainControlList,
                echoCancellationList,
                noiseSuppressionList
            });
        }
    }

    render() {
        return (
            <div>
                <h4>Audio effects</h4>
                {this.state.supportedAudioEffects.length > 0 ?
                    <div>
                        <Dropdown
                            label='Auto Gain Control'
                            onChange={(e, item) => this.agcSelectionChanged(e, item)}
                            options={this.state.autoGainControlList}
                            placeholder={'Select an option'}
                            styles={{ dropdown: { width: 300, color: 'black' } }}
                        />
                        <Dropdown
                            label='Echo Cancellation'
                            onChange={(e, item) => this.ecSelectionChanged(e, item)}
                            options={this.state.echoCancellationList}
                            placeholder={'Select an option'}
                            styles={{ dropdown: { width: 300, color: 'black' } }}
                        />
                        <Dropdown
                            label='Noise Suppression'
                            onChange={(e, item) => this.nsSelectionChanged(e, item)}
                            options={this.state.noiseSuppressionList}
                            placeholder={'Select an option'}
                            styles={{ dropdown: { width: 300, color: 'black' } }}
                        />

                        <PrimaryButton
                            className='secondary-button mt-2'
                            onClick={() => this.startEffects()}
                        >
                            {this.state.startEffectsLoading ? <LoadingSpinner /> : 'Start Effects'}
                        </PrimaryButton>

                        <PrimaryButton
                            className='secondary-button mt-2'
                            onClick={() => this.stopEffects()}
                        >
                            {this.state.stopEffectsLoading ? <LoadingSpinner /> : 'Stop Effects'}
                        </PrimaryButton>
                    </div>
                    :
                    <div>
                        Audio effects and enhancements are not supported in the current environment. <br/>
                        They are currently only supported on Windows Chrome, Windows Edge, MacOS Chrome, MacOS Edge and MacOS Safari.
                    </div>
                }
            </div>
        )
    }
}
