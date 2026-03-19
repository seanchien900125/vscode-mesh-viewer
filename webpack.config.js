/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';
const path = require('path');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  devtool: 'source-map',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  }
};

/** @type {import('webpack').Configuration} */
const viewerConfig = {
  target: 'web',
  mode: 'none',
  devtool: 'source-map',
  entry: './media/viewer.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'viewer.js'
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              module: 'esnext'
            }
          }
        }
      }
    ]
  }
};

/** @type {import('webpack').Configuration} */
const validatorConfig = {
  target: 'node',
  mode: 'none',
  devtool: 'source-map',
  entry: './src/validateTestMeshes.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'validateTestMeshes.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    path: 'commonjs path',
    fs: 'commonjs fs'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  }
};

module.exports = [extensionConfig, viewerConfig, validatorConfig];
