#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack.js';
import { DataStack } from '../lib/data-stack.js';
import { PipelineStack } from '../lib/pipeline-stack.js';

const app = new cdk.App();

const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: 'us-east-1',
};

const dataStack = new DataStack(app, 'ContextKeeper-DataStack', { env });

const pipelineStack = new PipelineStack(app, 'ContextKeeper-PipelineStack', {
  env,
  table: dataStack.table,
  bucket: dataStack.bucket,
});

new ApiStack(app, 'ContextKeeper-ApiStack', {
  env,
  table: dataStack.table,
  ingestQueue: pipelineStack.ingestQueue,
  bucket: dataStack.bucket,
  digestFn: pipelineStack.digestFn,
  busterFn: pipelineStack.busterFn,
});
