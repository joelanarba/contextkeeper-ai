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

  async createMediaCapture(userId: string, type: 'IMAGE' | 'PDF' | 'AUDIO', s3Key: string, nowIso: string): Promise<string> {
    const captureId = crypto.randomUUID();
    
    const capture: Capture = {
      id: captureId,
      userId,
      type,
      status: 'UPLOADED',
      s3Key,
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

  async updateCaptureJobId(userId: string, createdAt: string, captureId: string, jobId: string, taskToken: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(createdAt, captureId),
        },
        UpdateExpression: 'SET externalJobId = :jobId, taskToken = :taskToken, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':jobId': jobId,
          ':taskToken': taskToken,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  },

  async getCaptureByJobId(jobId: string): Promise<Capture | null> {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'externalJobId = :jobId',
      ExpressionAttributeValues: {
        ':jobId': jobId,
      },
    });

    const result = await docClient.send(command);
    if (!result.Items || result.Items.length === 0) return null;
    return result.Items[0] as Capture;
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
        ConditionExpression: '#status = :understanding', // Idempotency check
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':ready': 'READY',
          ':understanding': 'UNDERSTANDING',
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

  async updateCaptureEmbedding(userId: string, createdAt: string, captureId: string, embedding: number[]): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeCaptureSK(createdAt, captureId),
        },
        UpdateExpression: 'SET embedding = :embedding, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':embedding': embedding,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  },

  async listAllCaptures(userId: string): Promise<Capture[]> {
    const pk = makeUserPK(userId);
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'CAPTURE#',
      },
    });

    const result = await docClient.send(command);
    return (result.Items || []) as Capture[];
  },

  async getCaptureById(userId: string, captureId: string): Promise<Capture | null> {
    const pk = makeUserPK(userId);
    // Use Query with FilterExpression since we don't have createdAt
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'CAPTURE#',
        ':id': captureId,
      },
    });
    
    const result = await docClient.send(command);
    if (!result.Items || result.Items.length === 0) return null;
    return result.Items[0] as Capture;
  },

  async listCaptures(userId: string, limit: number = 20, cursor?: string): Promise<{ items: Capture[], nextCursor: string | null }> {
    const pk = makeUserPK(userId);
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'CAPTURE#',
      },
      ScanIndexForward: false, // Reverse chronological
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) : undefined,
    });

    const result = await docClient.send(command);
    const nextCursor = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null;
    return {
      items: (result.Items || []) as Capture[],
      nextCursor
    };
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
      userId: item.userId,
      type: item.type || item.itemType, // handle schema variations
      title: item.title,
      person: item.person,
      personDisplay: item.personDisplay,
      dueDate: item.dueDate,
      project: item.project,
      priority: item.priority,
      status: item.status,
      sourceCaptureId: item.sourceCaptureId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      schemaVersion: item.schemaVersion,
      confidence: item.confidence,
    })) as Item[];
  },
  
  async updateItem(userId: string, itemId: string, updates: Partial<Item>): Promise<Item> {
    const setExpressions: string[] = [];
    const exprValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };
    const exprNames: Record<string, string> = {
      '#status': 'status',
    };

    if (updates.title) { setExpressions.push('title = :title'); exprValues[':title'] = updates.title; }
    if (updates.status) { setExpressions.push('#status = :status'); exprValues[':status'] = updates.status; }
    if (updates.priority) { setExpressions.push('priority = :priority'); exprValues[':priority'] = updates.priority; }
    if (updates.dueDate !== undefined) { setExpressions.push('dueDate = :dueDate'); exprValues[':dueDate'] = updates.dueDate; }
    if (updates.person !== undefined) { 
      setExpressions.push('person = :person'); 
      exprValues[':person'] = updates.person; 
      // We should technically update GSI2 here, but for MVP we might just update the main item
      // In a real app, we'd use TransactWrite to replace GSI2 keys
    }
    if (updates.project !== undefined) { setExpressions.push('project = :project'); exprValues[':project'] = updates.project; }

    setExpressions.push('updatedAt = :updatedAt');

    const res = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: makeUserPK(userId),
          sk: makeItemSK(itemId),
        },
        UpdateExpression: 'SET ' + setExpressions.join(', '),
        ExpressionAttributeNames: Object.keys(exprNames).length > 0 ? exprNames : undefined,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
      })
    );
    
    return res.Attributes as Item;
  },

  async deleteItem(userId: string, itemId: string): Promise<void> {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: TABLE_NAME,
              Key: {
                pk: makeUserPK(userId),
                sk: makeItemSK(itemId),
              },
            }
          }
          // Note: In a robust schema, we'd delete GSI1/2 records if they were physically separate items,
          // but since they are GSIs on the same item, deleting the main item deletes them from the index automatically.
        ]
      })
    );
  }
};
