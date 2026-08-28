import { TextractClient, StartDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { repo } from '../../db/repo.js';

const textract = new TextractClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event: any): Promise<any> => {
  const { userId, captureId, createdAt, s3Key } = event.Input;
  const taskToken = event.TaskToken;

  if (!BUCKET_NAME) throw new Error('BUCKET_NAME missing');

  // Textract JobTag can be up to 64 chars.
  // Actually we can just store the mapping in DynamoDB and fetch by JobId in the callback.
  
  const command = new StartDocumentTextDetectionCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: BUCKET_NAME,
        Name: s3Key,
      }
    }
  });

  const response = await textract.send(command);
  const jobId = response.JobId;
  
  if (!jobId) throw new Error('Failed to start Textract job');

  // We store the mapping by captureId in our DB, but the EventBridge callback gives us JobId.
  // We need a way to look up the capture by JobId.
  // We can just add a GSI on externalJobId.
  
  await repo.updateCaptureJobId(userId, createdAt, captureId, jobId, taskToken);

  return { jobId };
};
