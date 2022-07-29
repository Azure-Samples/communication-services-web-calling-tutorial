// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const appSettings = require('../../appsettings.json');

export const getResourceConnectionString = (): string => {
  const resourceConnectionString = process.env['ResourceConnectionString'] || appSettings.ResourceConnectionString;

  if (!resourceConnectionString) {
    throw new Error('No ACS connection string provided. Set ResourceConnectionString in environment or in appSettings.');
  }

  return resourceConnectionString;
};