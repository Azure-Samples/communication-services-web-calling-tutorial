// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import express from 'express';
import cors from 'cors';
import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import path from 'path';

import provisionUser from './routes/provisionUser';

const app = express();

app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.resolve(__dirname, 'build')));

/**
 * route: /provisionUser
 * purpose: Return a new token for a new user to enable calling for.
 */
app.use('/tokens/provisionUser', cors(), provisionUser);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

export default app;
