#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack.js';
import { DataStack } from '../lib/data-stack.js';

const app = new cdk.App();

const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: 'us-east-1',
};

new DataStack(app, 'ContextKeeper-DataStack', { env });
new ApiStack(app, 'ContextKeeper-ApiStack', { env });
