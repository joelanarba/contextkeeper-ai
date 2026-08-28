import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';


const textract = new TextractClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event: any): Promise<any> => {
  const { s3Key } = event;
  
  if (!BUCKET_NAME) throw new Error('BUCKET_NAME missing');

  // We only run sync textract for IMAGE and single-page PDF, but for MVP we assume PDF sync works
  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: {
        Bucket: BUCKET_NAME,
        Name: s3Key,
      }
    }
  });

  const response = await textract.send(command);
  
  const text = response.Blocks?.filter((b: any) => b.BlockType === 'LINE')
    .map((b: any) => b.Text)
    .join('\n') || '';

  // Store raw text in DynamoDB (or S3 if too large, but ignoring for now)
  // Wait, repo doesn't have an updateRawText method. We can add one or just pass it in event.
  // We'll pass it in the event for understandFn to use.
  
  return {
    ...event,
    rawText: text,
  };
};
