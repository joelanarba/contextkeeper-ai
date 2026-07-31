import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';
import crypto from 'node:crypto';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = withErrors(async (event) => {
  const userId = withAuth(event);

  if (!BUCKET_NAME) {
    throw new Error('BUCKET_NAME environment variable is required');
  }

  const filename = event.queryStringParameters?.filename;
  const contentType = event.queryStringParameters?.contentType;

  if (!filename || !contentType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'filename and contentType query parameters are required' } }),
    };
  }

  // Generate a random UUID to avoid collisions
  const fileId = crypto.randomUUID();
  
  // Format the key as: USER#<userId>/<fileId>-<filename>
  // By putting it under USER#<userId>, we isolate user files (easier to clean up, track ownership).
  const s3Key = `USER#${userId}/${fileId}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  });

  // Expire the URL in 15 minutes
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: presignedUrl,
      s3Key,
    }),
  };
});
