import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';

function cosineSimilarity(A: number[], B: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const a = A[i] as number;
    const b = B[i] as number;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const handler = withErrors(async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userId = withAuth(event);
  
  if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
    }

    const { question } = JSON.parse(event.body);
    if (!question || typeof question !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid question format' }) };
    }

    // 1. Fetch all captures for the user
    // TRADE-OFF: We fetch all captures in memory. Works fine for < 5000 items.
    const allCaptures = await repo.listAllCaptures(userId);

    // Filter to captures that have embeddings
    const capturesWithEmbeddings = allCaptures.filter(c => c.embedding && c.embedding.length > 0);

    // 2. Generate question embedding
    const questionEmbedding = await OpenAIProvider.generateEmbedding(question);

    // 3. Compute cosine similarities
    const scoredCaptures = capturesWithEmbeddings.map(capture => {
      // We already filtered for capture.embedding && capture.embedding.length > 0
      const score = cosineSimilarity(questionEmbedding, capture.embedding as number[]);
      return { capture, score };
    });

    // 4. Sort and take top 12
    scoredCaptures.sort((a, b) => b.score - a.score);
    const topContexts = scoredCaptures.slice(0, 12).map(sc => sc.capture);

    // 5. Synthesize answer
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
    const answer = await OpenAIProvider.answerQuestion(question, topContexts, currentDate);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    };
});
