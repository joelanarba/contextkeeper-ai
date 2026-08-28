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
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
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
  public readonly digestFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'ContextKeeper');

    // 1. DLQ and Ingest Queue
    const dlq = new sqs.Queue(this, 'IngestDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    this.ingestQueue = new sqs.Queue(this, 'IngestQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    // --- Lambdas for Step Functions ---
    const createLambda = (idStr: string, handlerFile: string, memorySize = 256, timeout = 30) => {
      return new NodejsFunction(this, idStr, {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(HANDLERS_DIR, 'pipeline', handlerFile),
        handler: 'handler',
        memorySize,
        timeout: cdk.Duration.seconds(timeout),
        environment: {
          TABLE_NAME: props.table.tableName,
          BUCKET_NAME: props.bucket.bucketName,
        },
        bundling: { target: 'node22', sourceMap: true, format: 'esm' as OutputFormat },
      });
    };

    const determineTypeFn = createLambda('DetermineTypeFn', 'determineType.ts');
    const textractSyncFn = createLambda('TextractSyncFn', 'textractSync.ts', 512, 60);
    const startTextractAsyncFn = createLambda('StartTextractAsyncFn', 'startTextractAsync.ts');
    const textractCallbackFn = createLambda('TextractCallbackFn', 'textractCallback.ts', 512, 60);
    const startTranscribeFn = createLambda('StartTranscribeFn', 'startTranscribe.ts');
    const transcribeCallbackFn = createLambda('TranscribeCallbackFn', 'transcribeCallback.ts', 512, 60);
    const understandFn = createLambda('UnderstandPipelineFn', 'understand.ts', 1024, 60);
    const embedFn = createLambda('EmbedFn', 'embed.ts', 512, 60);
    const markReadyFn = createLambda('MarkReadyFn', 'markReady.ts');
    
    // Permissions
    props.table.grantReadWriteData(determineTypeFn);
    props.table.grantReadWriteData(textractSyncFn);
    props.table.grantReadWriteData(startTextractAsyncFn);
    props.table.grantReadWriteData(textractCallbackFn);
    props.table.grantReadWriteData(startTranscribeFn);
    props.table.grantReadWriteData(transcribeCallbackFn);
    props.table.grantReadWriteData(understandFn);
    props.table.grantReadWriteData(embedFn);
    props.table.grantReadWriteData(markReadyFn);
    
    props.bucket.grantRead(textractSyncFn);
    props.bucket.grantRead(startTextractAsyncFn);
    props.bucket.grantRead(startTranscribeFn);
    props.bucket.grantRead(textractCallbackFn);
    props.bucket.grantRead(transcribeCallbackFn);

    textractSyncFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['textract:DetectDocumentText'], resources: ['*'] }));
    startTextractAsyncFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['textract:StartDocumentTextDetection'], resources: ['*'] }));
    textractCallbackFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['textract:GetDocumentTextDetection'], resources: ['*'] }));
    startTranscribeFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['transcribe:StartTranscriptionJob'], resources: ['*'] }));
    transcribeCallbackFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['transcribe:GetTranscriptionJob'], resources: ['*'] }));
    
    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/contextkeeper/openai-api-key`],
    });
    understandFn.addToRolePolicy(ssmPolicy);
    embedFn.addToRolePolicy(ssmPolicy);

    // --- Step Functions Tasks ---
    const determineTypeTask = new tasks.LambdaInvoke(this, 'DetermineType', {
      lambdaFunction: determineTypeFn,
      outputPath: '$.Payload',
    });

    const textractSyncTask = new tasks.LambdaInvoke(this, 'ExtractImageText', {
      lambdaFunction: textractSyncFn,
      outputPath: '$.Payload',
    });

    const startTextractAsyncTask = new tasks.LambdaInvoke(this, 'StartTextractAsync', {
      lambdaFunction: startTextractAsyncFn,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        TaskToken: sfn.JsonPath.taskToken,
        Input: sfn.JsonPath.entirePayload,
      }),
    });

    const startTranscribeTask = new tasks.LambdaInvoke(this, 'StartTranscribe', {
      lambdaFunction: startTranscribeFn,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        TaskToken: sfn.JsonPath.taskToken,
        Input: sfn.JsonPath.entirePayload,
      }),
    });

    const understandTask = new tasks.LambdaInvoke(this, 'LLM Extraction', {
      lambdaFunction: understandFn,
      outputPath: '$.Payload',
    });

    const embedTask = new tasks.LambdaInvoke(this, 'Generate Embeddings', {
      lambdaFunction: embedFn,
      outputPath: '$.Payload',
    });

    const markReadyTask = new tasks.LambdaInvoke(this, 'Mark Capture Ready', {
      lambdaFunction: markReadyFn,
      outputPath: '$.Payload',
    });

    // --- Step Functions Definition ---
    const choiceState = new sfn.Choice(this, 'Branch on MediaType')
      .when(sfn.Condition.booleanEquals('$.skipProcessing', true), markReadyTask)
      .when(sfn.Condition.stringEquals('$.mediaType', 'TEXT'), understandTask)
      .when(sfn.Condition.stringEquals('$.mediaType', 'IMAGE'), textractSyncTask.next(understandTask))
      .when(sfn.Condition.stringEquals('$.mediaType', 'PDF'), startTextractAsyncTask.next(understandTask))
      .when(sfn.Condition.stringEquals('$.mediaType', 'AUDIO'), startTranscribeTask.next(understandTask))
      .otherwise(markReadyTask);

    const definition = determineTypeTask.next(choiceState);
    understandTask.next(embedTask).next(markReadyTask);

    const pipelineStateMachine = new sfn.StateMachine(this, 'CapturePipeline', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
      stateMachineType: sfn.StateMachineType.STANDARD,
    });
    
    // Grant callbacks permission to SendTaskSuccess/Failure
    pipelineStateMachine.grantTaskResponse(textractCallbackFn);
    pipelineStateMachine.grantTaskResponse(transcribeCallbackFn);
    
    // --- EventBridge rules for Callbacks ---
    new events.Rule(this, 'TextractCallbackRule', {
      eventPattern: { source: ['aws.textract'], detailType: ['TextractDocumentTextDetection'] },
      targets: [new targets.LambdaFunction(textractCallbackFn)],
    });
    new events.Rule(this, 'TranscribeCallbackRule', {
      eventPattern: { source: ['aws.transcribe'], detailType: ['Transcribe Job State Change'] },
      targets: [new targets.LambdaFunction(transcribeCallbackFn)],
    });

    // --- SQS to Step Functions Trigger ---
    const sqsToStepFn = new NodejsFunction(this, 'SqsToStepFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'pipeline', 'sqsToStepFn.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: { STATE_MACHINE_ARN: pipelineStateMachine.stateMachineArn },
      bundling: { target: 'node22', sourceMap: true, format: 'esm' as OutputFormat },
    });
    pipelineStateMachine.grantStartExecution(sqsToStepFn);
    sqsToStepFn.addEventSource(new SqsEventSource(this.ingestQueue, { batchSize: 1 }));

    // --- 5. Weekly Digest Lambda ---
    this.digestFn = new NodejsFunction(this, 'DigestFn', {
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
      bundling: { target: 'node22', sourceMap: true, format: 'esm' as OutputFormat },
    });

    props.table.grantReadData(this.digestFn);
    this.digestFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] }));
    this.digestFn.addToRolePolicy(ssmPolicy);
    this.digestFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers'], resources: ['*'] }));

    const rule = new events.Rule(this, 'WeeklyDigestRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '17', weekDay: 'SUN' }),
    });
    rule.addTarget(new targets.LambdaFunction(this.digestFn));

    // --- 6. Procrastination Buster Agent ---
    const busterFn = new NodejsFunction(this, 'ProcrastinationBusterFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'procrastinationBuster.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
      environment: {
        TABLE_NAME: props.table.tableName,
        // USER_POOL_ID will be set by ApiStack, just like digestFn
      },
      bundling: { target: 'node22', sourceMap: true, format: 'esm' as OutputFormat },
    });

    props.table.grantReadWriteData(busterFn);
    busterFn.addToRolePolicy(ssmPolicy);
    busterFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers'], resources: ['*'] }));

    // Run nightly at 2 AM UTC
    const busterRule = new events.Rule(this, 'ProcrastinationBusterRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '2' }),
    });
    busterRule.addTarget(new targets.LambdaFunction(busterFn));
    
    // We need to expose busterFn so ApiStack can inject USER_POOL_ID
    this.busterFn = busterFn;
  }
  public readonly busterFn: NodejsFunction;
}
