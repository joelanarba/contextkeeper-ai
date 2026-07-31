import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Construct } from 'constructs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS_DIR = path.join(__dirname, '..', '..', 'services', 'api', 'src', 'handlers');

export interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  bucket: s3.IBucket;
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
        BUCKET_NAME: props.bucket.bucketName,
      },
      bundling: {
        target: 'node22',
        sourceMap: true,
        format: OutputFormat?.ESM ?? ('esm' as OutputFormat),
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

    // 4. Permissions
    props.table.grantReadWriteData(understandFn);
    props.bucket.grantRead(understandFn);

    // Add SQS Trigger (batchSize 1 for easier error isolation in MVP)
    understandFn.addEventSource(
      new SqsEventSource(this.ingestQueue, {
        batchSize: 1,
      })
    );

    // 5. Weekly Digest Lambda
    const digestFn = new NodejsFunction(this, 'DigestFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'digest.ts'),
      handler: 'handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        TABLE_NAME: props.table.tableName,
        SENDER_EMAIL: 'anarbajoel@gmail.com', // As specified by user
      },
      bundling: {
        target: 'node22',
        sourceMap: true,
        format: OutputFormat?.ESM ?? ('esm' as OutputFormat),
      },
    });

    // Grant DynamoDB read, SES send, and SSM GetParameter
    props.table.grantReadData(digestFn);
    digestFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'], // In production, restrict to verified identity ARN
      })
    );
    digestFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/contextkeeper/openai-api-key`,
        ],
      })
    );

    // Verify Sender Identity (OMITTED: Identity already exists in AWS account)

    // 6. EventBridge Schedule (Cron) - e.g., Every Friday at 5 PM UTC
    const rule = new events.Rule(this, 'WeeklyDigestRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '17',
        weekDay: 'FRI',
      }),
    });
    rule.addTarget(new targets.LambdaFunction(digestFn));
  }
}
