import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-sfn';
import { TranscribeClient, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { repo } from '../../db/repo.js';

const sfn = new SFNClient({});
const transcribe = new TranscribeClient({});

export const handler = async (event: any): Promise<void> => {
  // EventBridge structure for Transcribe: detail.TranscriptionJobName and detail.TranscriptionJobStatus
  const jobId = event.detail?.TranscriptionJobName;
  const status = event.detail?.TranscriptionJobStatus;

  if (!jobId) {
    console.error('No TranscriptionJobName in event', JSON.stringify(event));
    return;
  }

  const capture = await repo.getCaptureByJobId(jobId);
  if (!capture || !capture.taskToken) {
    console.error(`No capture or taskToken found for JobId ${jobId}`);
    return;
  }

  if (status !== 'COMPLETED') {
    await sfn.send(new SendTaskFailureCommand({
      taskToken: capture.taskToken,
      error: 'TranscribeFailed',
      cause: `Status was ${status}`,
    }));
    return;
  }

  try {
    const res = await transcribe.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobId,
    }));
    
    const transcriptUri = res.TranscriptionJob?.Transcript?.TranscriptFileUri;
    if (!transcriptUri) throw new Error('No TranscriptFileUri returned');

    // Fetch the transcript file from S3 (it's a pre-signed URL returned by Transcribe)
    const transcriptRes = await fetch(transcriptUri);
    const transcriptData = await transcriptRes.json();
    
    const fullText = transcriptData.results.transcripts[0]?.transcript || '';

    await sfn.send(new SendTaskSuccessCommand({
      taskToken: capture.taskToken,
      output: JSON.stringify({
        userId: capture.userId,
        captureId: capture.id,
        createdAt: capture.createdAt,
        s3Key: capture.s3Key,
        mediaType: capture.type,
        rawText: fullText,
        skipProcessing: false,
      }),
    }));
  } catch (err: any) {
    await sfn.send(new SendTaskFailureCommand({
      taskToken: capture.taskToken,
      error: 'TranscribeRetrievalFailed',
      cause: err.message,
    }));
  }
};
