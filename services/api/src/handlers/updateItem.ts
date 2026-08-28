import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';
import { UpdateItemInput } from '@contextkeeper/core';

export const handler = withErrors(async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userId = withAuth(event);
  const itemId = event.pathParameters?.id;

  if (!itemId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing item id' }) };
  }
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
  }

  const parsed = UpdateItemInput.safeParse(JSON.parse(event.body));
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid input', details: parsed.error.issues }) };
  }

  const updatedItem = await repo.updateItem(userId, itemId, parsed.data as any);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedItem),
  };
});
