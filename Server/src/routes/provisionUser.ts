// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as express from 'express';
import { getResourceConnectionString } from '../lib/envHelper';
import { CommunicationIdentityClient } from '@azure/communication-identity';

const router = express.Router();

const communicationIdentityClient = new  CommunicationIdentityClient(getResourceConnectionString());

const provisionUser = async (req: express.Request, res: express.Response) => {
  try {
      const tokenResponse = await communicationIdentityClient.createUserAndToken(["voip"]);
      console.log(JSON.stringify(tokenResponse));
      res.json(tokenResponse);
  } catch (error) {
      console.error(error);
  }
}

/**
 * route: /provisionUser/
 *
 * purpose: Create a user and a token to do voip calling.
 *
 * @returns JSON with the token and the user that were created.
 *
 */

router.get('/', provisionUser);
router.post('/', provisionUser);

export default router;
