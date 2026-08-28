import { OpenAIProvider } from '../../llm/OpenAIProvider.js';
import { repo } from '../../db/repo.js';

export const handler = async (event: any): Promise<any> => {
  if (event.skipProcessing) return event;
  
  const { userId, captureId, createdAt, textToEmbed } = event;

  try {
    const embedding = await OpenAIProvider.generateEmbedding(textToEmbed);
    await repo.updateCaptureEmbedding(userId, createdAt, captureId, embedding);
  } catch (err) {
    console.error(`Failed to generate embedding for capture ${captureId}:`, err);
    // don't fail the pipeline
  }

  return event;
};
