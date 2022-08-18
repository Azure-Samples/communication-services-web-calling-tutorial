// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import express from 'express';
import cors from 'cors';
import createError from 'http-errors';
import path from 'path';
import { CommunicationIdentityClient } from '@azure/communication-identity';
import appSettings from '../appsettings.json' assert {type: "json"};


/**
 * Setup ExpressJS Server.
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.resolve('build')));

/**
 * Load connectionString from environment variables or from appsettings.json.
 * @returns ResourceConnectionString
 */
export const getResourceConnectionString = () => {
  const resourceConnectionString = process.env['ResourceConnectionString'] || appSettings?.ResourceConnectionString;
  
  if (!resourceConnectionString) {
    throw new Error('No ACS connection string provided. Set ResourceConnectionString in environment or in appsettings.json.');
  }
  
  return resourceConnectionString;
};

/**
 * Route: /tokens/provisionUser/
 * Purpose: Create a user and a token to do voip calling.
 *
 * @returns JSON with the token and the user that were created.
 *
 */
 const provisionUser = async (req, res) => {
  try {
      const token = await new CommunicationIdentityClient(getResourceConnectionString())
        .createUserAndToken(["voip"]);
      res.json(token);
  } catch (error) {
      console.error(error);
  }
}

const router = express.Router();
router.get('/', provisionUser);
router.post('/', provisionUser);

/**
 * route: /provisionUser
 * purpose: Return a new token for a new user to enable calling for.
 */
app.use('/tokens/provisionUser', cors(), router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

export default app;
