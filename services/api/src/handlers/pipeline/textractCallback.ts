import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-sfn';
import { TextractClient, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { repo } from '../../db/repo.js';

const sfn = new SFNClient({});
const textract = new TextractClient({});

export const handler = async (event: any): Promise<void> => {
  // EventBridge structure for Textract: detail.JobId and detail.Status
  const jobId = event.detail?.JobId;
  const status = event.detail?.Status;

  if (!jobId) {
    console.error('No JobId in event', JSON.stringify(event));
    return;
  }

  const capture = await repo.getCaptureByJobId(jobId);
  if (!capture || !capture.taskToken) {
    console.error(`No capture or taskToken found for JobId ${jobId}`);
    return;
  }

  if (status !== 'SUCCEEDED') {
    await sfn.send(new SendTaskFailureCommand({
      taskToken: capture.taskToken,
      error: 'TextractFailed',
      cause: `Status was ${status}`,
    }));
    return;
  }

  try {
    let nextToken: string | undefined = undefined;
    let fullText = '';

    do {
      const res: any = await textract.send(new GetDocumentTextDetectionCommand({
        JobId: jobId,
        NextToken: nextToken,
      }));
      
      const lines = res.Blocks?.filter((b: any) => b.BlockType === 'LINE').map((b: any) => b.Text) || [];
      fullText += lines.join('\n') + '\n';
      
      nextToken = res.NextToken;
    } while (nextToken);

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
      error: 'TextractRetrievalFailed',
      cause: err.message,
    }));
  }
};
