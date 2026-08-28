import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';

export const handler = withErrors(async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userId = withAuth(event);
  
  const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
  const cursor = event.queryStringParameters?.cursor;

  const result = await repo.listCaptures(userId, limit, cursor);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
});
