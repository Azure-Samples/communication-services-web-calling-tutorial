// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as express from 'express';
import { getResourceConnectionString } from '../lib/envHelper';

const router = express.Router();

/**
 * route: /getConnectionString/
 *
 * purpose: Get the connection string url of Azure Communication Services resource.
 *
 * @returns The connection string url as string
 *
 */

router.get('/', async function (req, res, next) {
  res.send(getResourceConnectionString());
});

export default router;
