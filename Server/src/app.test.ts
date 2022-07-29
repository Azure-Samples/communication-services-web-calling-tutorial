// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../node_modules/@types/jest/index.d.ts" />

import request from 'supertest';
import * as identity from '../src/lib/identityClient';
import app from './app';
import { CommunicationUserToken } from '@azure/communication-identity';

// Setup mocks
const mockUserToken: CommunicationUserToken = {
  user: { communicationUserId: 'mock-token-user' },
  token: 'mock-token-value',
  expiresOn: new Date(0)
};

let createUserAndTokenSpy: jest.SpyInstance;

beforeAll(() => {
  createUserAndTokenSpy = jest.spyOn(identity, 'createUserAndToken').mockImplementation(async () => mockUserToken);
});

describe('app route tests', () => {
  test('/tokens/provisionUser should return a token with voip scope with GET and POST requests', async () => {
    const getResponse = await request(app).post('/tokens/provisionUser');
    expect(getResponse.status).toEqual(200);
    expect(getResponse.text).toEqual(JSON.stringify(mockUserToken));
    expect(createUserAndTokenSpy).toHaveBeenLastCalledWith(['voip']);
    createUserAndTokenSpy.mockClear();

    const postResponse = await request(app).post('/tokens/provisionUser');
    expect(postResponse.status).toEqual(200);
    expect(postResponse.text).toEqual(JSON.stringify(mockUserToken));
    expect(createUserAndTokenSpy).toHaveBeenLastCalledWith(['voip']);
    createUserAndTokenSpy.mockClear();
  });
});
