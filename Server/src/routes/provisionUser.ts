// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as express from 'express';
import { getResourceConnectionString } from '../lib/envHelper';
import { CommunicationIdentityClient } from '@azure/communication-identity';

const router = express.Router();

const communicationIdentityClient = new  CommunicationIdentityClient(getResourceConnectionString());

/**
 * route: /getEndpointUrl/
 *
 * purpose: Get the endpoint url of Azure Communication Services resource.
 *
 * @returns The endpoint url as string
 *
 */

router.post('/', async (req, res) => {
  try {
      const tokenResponse = await communicationIdentityClient.createUserAndToken(["voip"]);
      res.json(tokenResponse);
  } catch (error) {
      console.error(error);
  }
});

export default router;
