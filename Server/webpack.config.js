// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const webConfig = path.resolve('web.config');
const distDir = path.resolve('dist');

const config = {
  name: 'server',
  entry: './src/www.js',
  target: 'node',
  output: {
    path: distDir,
    filename: 'server.js'
  },
  resolve: {
    extensions: ['.js']
  },
  optimization: {
    minimize: false
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: webConfig, to: distDir }]
    })
  ]
};

export default config;