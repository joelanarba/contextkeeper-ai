import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { CreateTextCaptureInput, ValidationError } from '@contextkeeper/core';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';
import { repo } from '../db/repo.js';

const sqs = new SQSClient({});
const QUEUE_URL = process.env.INGEST_QUEUE_URL;

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
  const parseResult = CreateTextCaptureInput.safeParse(parsed);
  if (!parseResult.success) {
    throw new ValidationError(`Invalid input: ${parseResult.error.message}`);
  }

  const { text } = parseResult.data;
  const nowIso = new Date().toISOString();

  // 1. Write to DynamoDB as UPLOADED
  const captureId = await repo.createTextCapture(userId, text, nowIso);

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
