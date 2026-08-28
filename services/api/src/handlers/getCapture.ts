import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';

export const handler = withErrors(async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userId = withAuth(event);
  const captureId = event.pathParameters?.id;

  if (!captureId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing capture id' }) };
  }

  const capture = await repo.getCaptureById(userId, captureId);
  
  if (!capture) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Capture not found' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(capture),
  };
});
