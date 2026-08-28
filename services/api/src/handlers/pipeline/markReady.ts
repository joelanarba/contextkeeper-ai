import { repo } from '../../db/repo.js';

export const handler = async (event: any): Promise<any> => {
  if (event.skipProcessing) return event;
  
  const { userId, captureId, createdAt, extractedItems } = event;

  // We save extracted items transactionally and mark capture READY
  await repo.saveExtractedItems(userId, createdAt, captureId, extractedItems);

  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'Successfully processed capture via Step Functions',
    captureId,
    itemsExtracted: extractedItems.length,
  }));

  return { status: 'SUCCESS', captureId };
};
