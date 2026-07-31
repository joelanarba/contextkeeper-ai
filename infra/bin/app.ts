#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { DataStack } from '../lib/data-stack.js';

const app = new cdk.App();

new DataStack(app, 'ContextKeeper-DataStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: 'us-east-1',
  },
});
