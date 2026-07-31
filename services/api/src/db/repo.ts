import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  makeUserPK,
  makeCaptureSK,
  makeItemSK,
  makeGSI1PK,
  makeGSI1SK,
  makeGSI2PK,
  makeGSI2SK,
  normalizeName,
  CaptureStatus,
  type Capture,
  type Item,
} from '@contextkeeper/core';
import { z } from 'zod';
import crypto from 'node:crypto';

// Setup DDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) throw new Error('TABLE_NAME environment variable is required');

export const repo = {
  async createTextCapture(userId: string, text: string, nowIso: string): Promise<string> {
    const captureId = crypto.randomUUID();
    
    const capture: Capture = {
      id: captureId,
      userId,
      type: 'TEXT',
      status: 'UPLOADED',
      rawText: text,
      createdAt: nowIso,
      updatedAt: nowIso,
      schemaVersion: 1,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(nowIso, captureId),
          ...capture,
        },
      })
    );

    return captureId;
  },

  async getCapture(userId: string, createdAt: string, captureId: string): Promise<Capture | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(createdAt, captureId),
        },
      })
    );
    return (res.Item as Capture) || null;
  },

  async updateCaptureStatus(userId: string, createdAt: string, captureId: string, status: z.infer<typeof CaptureStatus>, errorMessage?: string): Promise<void> {
    const updateExpr = errorMessage
      ? 'SET #status = :status, errorMessage = :errorMessage, updatedAt = :updatedAt'
      : 'SET #status = :status, updatedAt = :updatedAt';

    const exprValues: Record<string, unknown> = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };
    if (errorMessage) {
      exprValues[':errorMessage'] = errorMessage;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(createdAt, captureId),
        },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: exprValues,
      })
    );
  },

  async saveExtractedItems(userId: string, captureCreatedAt: string, captureId: string, items: Item[]): Promise<void> {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactItems: any[] = [];

    // 1. Update capture status to READY
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(captureCreatedAt, captureId),
        },
        UpdateExpression: 'SET #status = :ready, updatedAt = :updatedAt',
        ConditionExpression: '#status = :uploaded', // Idempotency check
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':ready': 'READY',
          ':uploaded': 'UPLOADED',
          ':updatedAt': now,
        },
      }
    });

    // 2. Insert items
    for (const item of items) {
      const itemRecord: Record<string, unknown> = {
        pk: makeUserPK(userId),
        sk: makeItemSK(item.id),
        gsi1pk: makeGSI1PK(userId, item.type),
        gsi1sk: makeGSI1SK(item.status, item.dueDate || '9999-12-31', item.id),
        ...item,
      };

      if (item.person) {
        const normName = normalizeName(item.person);
        itemRecord.gsi2pk = makeGSI2PK(userId, normName);
        itemRecord.gsi2sk = makeGSI2SK(item.createdAt);
      }

      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: itemRecord,
        }
      });
    }

    // DynamoDB TransactWriteItems limit is 100 items. If a single capture extracts > 99 items, this fails.
    // That is incredibly unlikely for a single capture note. We will execute as a single transaction.
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  },

  async listItems(userId: string): Promise<Item[]> {
    const pk = makeUserPK(userId);
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'ITEM#',
      },
    });

    const result = await docClient.send(command);
    
    // Map database items back to Item interface
    return (result.Items || []).map(item => ({
      id: item.id,
      type: item.itemType,
      title: item.title,
      person: item.person,
      dueDate: item.dueDate,
      project: item.project,
      priority: item.priority,
      status: item.status,
    })) as Item[];
  }
};
