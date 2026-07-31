import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Construct } from 'constructs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS_DIR = path.join(__dirname, '..', '..', 'services', 'api', 'src', 'handlers');

export interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
}

export class PipelineStack extends cdk.Stack {
  public readonly ingestQueue: sqs.IQueue;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'ContextKeeper');

    // 1. DLQ and Ingest Queue
    const dlq = new sqs.Queue(this, 'IngestDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    this.ingestQueue = new sqs.Queue(this, 'IngestQueue', {
      visibilityTimeout: cdk.Duration.seconds(60 * 6), // 6x Lambda timeout
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // 2. Understand Lambda (SQS Consumer)
    const understandFn = new NodejsFunction(this, 'UnderstandFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'understand.ts'),
      handler: 'handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
      bundling: {
        target: 'node22',
        sourceMap: true,
      },
    });

    // Grant access to read OpenAI key from SSM
    understandFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/contextkeeper/openai-api-key`,
        ],
      })
    );

    // Grant DynamoDB permissions
    props.table.grantReadWriteData(understandFn);

    // Add SQS Trigger (batchSize 1 for easier error isolation in MVP)
    understandFn.addEventSource(
      new SqsEventSource(this.ingestQueue, {
        batchSize: 1,
      })
    );
  }
}
