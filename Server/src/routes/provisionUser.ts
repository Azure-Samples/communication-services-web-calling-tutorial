// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as express from 'express';
import { createUserAndToken } from '../lib/identityClient';

const router = express.Router();


const provisionUser = async (req: express.Request, res: express.Response) => {
  try {
      const tokenResponse = await createUserAndToken(["voip"]);
      res.json(tokenResponse);
  } catch (error) {
      console.error(error);
  }
}

/**
 * route: /tokens/provisionUser/
 *
 * purpose: Create a user and a token to do voip calling.
 *
 * @returns JSON with the token and the user that were created.
 *
 */

router.get('/', provisionUser);
router.post('/', provisionUser);

export default router;
