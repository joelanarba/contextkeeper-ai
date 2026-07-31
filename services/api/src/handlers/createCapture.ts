import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { CreateTextCaptureInput, CreateMediaCaptureInput, ValidationError } from '@contextkeeper/core';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';
import { repo } from '../db/repo.js';
import { z } from 'zod';

const sqs = new SQSClient({});
const QUEUE_URL = process.env.INGEST_QUEUE_URL;

const InputSchema = z.union([CreateTextCaptureInput, CreateMediaCaptureInput]);

export const handler = withErrors(async (event) => {
  const userId = withAuth(event);
  
  if (!QUEUE_URL) {
    throw new Error('INGEST_QUEUE_URL environment variable is required');
  }

  if (!event.body) {
    throw new ValidationError('Request body is missing');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  // Parse input against Zod schema
  const parseResult = InputSchema.safeParse(parsed);
  if (!parseResult.success) {
    throw new ValidationError(`Invalid input: ${parseResult.error.message}`);
  }

  const data = parseResult.data;
  const nowIso = new Date().toISOString();
  let captureId: string;

  // 1. Write to DynamoDB as UPLOADED
  if (data.type === 'TEXT') {
    captureId = await repo.createTextCapture(userId, data.text, nowIso);
  } else {
    captureId = await repo.createMediaCapture(userId, data.type, data.s3Key, nowIso);
  }

  // 2. Put message on SQS for async extraction
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        userId,
        captureId,
        createdAt: nowIso,
      }),
    })
  );

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      captureId,
      status: 'UPLOADED',
    }),
  };
});
