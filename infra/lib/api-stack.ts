import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigwv2int from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS_DIR = path.join(__dirname, '..', '..', 'services', 'api', 'src', 'handlers');

export interface ApiStackProps extends cdk.StackProps {
  ingestQueue: sqs.IQueue;
  table: dynamodb.ITable;
  bucket: s3.IBucket;
}

export class ApiStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'ContextKeeper');

    // --- Cognito ---
    // Email sign-in, 12-char password minimum, advanced security in audit mode.
    // See CLAUDE.md section 9.
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ContextKeeperUserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      // advancedSecurityMode is deprecated in CDK 2.200+. Use the L1 escape hatch.
      // Equivalent to AUDIT mode — logs threats but doesn't block them.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.userPoolAddOns = { advancedSecurityMode: 'AUDIT' };

    const userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000/'],
        logoutUrls: ['http://localhost:3000/'],
      },
    });

    // Hosted UI domain — account ID suffix guarantees global uniqueness.
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `contextkeeper-${this.account}`,
      },
    });

    // --- Health Lambda ---
    const healthFn = new NodejsFunction(this, 'HealthFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'health.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        target: 'node22',
        sourceMap: true,
      },
    });

    // --- HTTP API ---
    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ContextKeeperAPI',
      corsPreflight: {
        allowOrigins: ['http://localhost:3000'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    // JWT authorizer backed by Cognito
    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;
    const jwtAuthorizer = new apigwv2auth.HttpJwtAuthorizer('CognitoAuthorizer', issuer, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });

    // GET /health — verifies auth pipeline end to end
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2int.HttpLambdaIntegration('HealthIntegration', healthFn),
      authorizer: jwtAuthorizer,
    });

    // --- Create Capture Endpoint ---
    const createCaptureFn = new NodejsFunction(this, 'CreateCaptureFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'createCapture.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: props.table.tableName,
        INGEST_QUEUE_URL: props.ingestQueue.queueUrl,
        BUCKET_NAME: props.bucket.bucketName,
      },
      bundling: {
        target: 'node22',
        sourceMap: true,
      },
    });

    props.table.grantReadWriteData(createCaptureFn);
    props.ingestQueue.grantSendMessages(createCaptureFn);

    this.httpApi.addRoutes({
      path: '/captures',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2int.HttpLambdaIntegration('CreateCaptureIntegration', createCaptureFn),
      authorizer: jwtAuthorizer,
    });

    const presignCaptureFn = new NodejsFunction(this, 'PresignCaptureFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(HANDLERS_DIR, 'presignCapture.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        BUCKET_NAME: props.bucket.bucketName,
      },
    });
    props.bucket.grantWrite(presignCaptureFn);

    this.httpApi.addRoutes({
      path: '/captures/presign',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2int.HttpLambdaIntegration('PresignCaptureIntegration', presignCaptureFn),
      authorizer: jwtAuthorizer,
    });

    // Throttling — single-user runaway-cost circuit breaker.
    // See CLAUDE.md section 9: 20 burst, 10 steady.
    const stage = this.httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = {
      throttlingBurstLimit: 20,
      throttlingRateLimit: 10,
    };

    // --- Outputs ---
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    // List Items Lambda
    const listItemsFn = new NodejsFunction(this, 'ListItemsFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../../services/api/src/handlers/listItems.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });
    props.table.grantReadData(listItemsFn);

    const listItemsIntegration = new apigwv2int.HttpLambdaIntegration('ListItemsIntegration', listItemsFn);
    this.httpApi.addRoutes({
      path: '/items',
      methods: [apigwv2.HttpMethod.GET],
      integration: listItemsIntegration,
      authorizer: jwtAuthorizer,
    });
  }
}

