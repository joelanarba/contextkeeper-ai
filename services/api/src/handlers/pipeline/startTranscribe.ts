import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { repo } from '../../db/repo.js';

const transcribe = new TranscribeClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event: any): Promise<any> => {
  const { userId, captureId, createdAt, s3Key } = event.Input;
  const taskToken = event.TaskToken;

  if (!BUCKET_NAME) throw new Error('BUCKET_NAME missing');

  // Encode IDs into the job name safely. Transcribe allows: ^[0-9a-zA-Z._-]+$
  const safeUserId = userId.replace(/[^0-9a-zA-Z._-]/g, '_');
  const safeCreatedAt = createdAt.replace(/[^0-9a-zA-Z._-]/g, '_');
  const jobId = `ctxkpr-${safeUserId}-${safeCreatedAt}-${captureId}`;
  
  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobId,
    LanguageCode: 'en-US',
    MediaFormat: s3Key.split('.').pop() || 'mp4',
    Media: {
      MediaFileUri: `s3://${BUCKET_NAME}/${s3Key}`
    },
  });

  await repo.updateCaptureJobId(userId, createdAt, captureId, jobId, taskToken);
  await transcribe.send(command);

  return { jobId };
};
