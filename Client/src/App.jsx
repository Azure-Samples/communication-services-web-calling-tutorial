import React from 'react';
import './App.css';
import MakeCall from './MakeCall/MakeCall'
import { initializeIcons } from '@uifabric/icons';

const rawCallingSdkVersion = require('../package.json').dependencies['@azure/communication-calling']

// Discard the first character of the version string if it contains a tilde or a caret
const callingSdkVersion = rawCallingSdkVersion
    .substring(rawCallingSdkVersion.indexOf('^') + 1)
    .substring(rawCallingSdkVersion.indexOf('~') + 1);

initializeIcons();

function App() {

  return (
    <div className="App">
      <div className="header ms-Grid">
        <div className="ms-Grid-row">
          <div className="ms-Grid-col ms-lg6">
            <h2>
              Azure Communication Services - Calling SDK for Javascript - { callingSdkVersion }
            </h2>
          </div>
          <div className="ms-Grid-col ms-lg6">
            <div className="sdk-docs-header">
              Documentation on how to use the ACS Calling SDK for Javascript can be found on <a className="sdk-docs-link" target="_blank" href="https://docs.microsoft.com/en-gb/azure/communication-services/quickstarts/voice-video-calling/calling-client-samples?pivots=platform-web">Microsoft Docs</a>
            </div>
            <div className="sdk-docs-header">
              <a className="sdk-docs-link" href="https://docs.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/?view=azure-communication-services-js">API Reference Documentation</a>
            </div>
          </div>
        </div>
      </div>
      <MakeCall/>
    </div>
  );
}

export default App;
