import { repo } from '../../db/repo.js';

export const handler = async (event: any): Promise<any> => {
  const { userId, captureId, createdAt } = event;
  const capture = await repo.getCaptureById(userId, captureId);
  
  if (!capture) {
    throw new Error(`Capture not found: ${captureId}`);
  }

  // Idempotency / state check
  if (capture.status !== 'UPLOADED') {
    return { ...event, skipProcessing: true };
  }

  // Set state to EXTRACTING (or UNDERSTANDING if it skips extraction)
  await repo.updateCaptureStatus(userId, createdAt, captureId, 'EXTRACTING');

  return {
    ...event,
    mediaType: capture.type,
    s3Key: capture.s3Key,
    rawText: capture.rawText,
    skipProcessing: false,
  };
};
