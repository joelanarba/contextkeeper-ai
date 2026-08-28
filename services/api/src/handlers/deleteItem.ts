import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';

export const handler = withErrors(async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userId = withAuth(event);
  const itemId = event.pathParameters?.id;

  if (!itemId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing item id' }) };
  }

  await repo.deleteItem(userId, itemId);

  return {
    statusCode: 204, // No Content
    headers: { 'Content-Type': 'application/json' },
    body: '',
  };
});
