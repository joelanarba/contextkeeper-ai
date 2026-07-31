import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';
import { repo } from '../db/repo.js';

export const handler = withErrors(async (event) => {
  // 1. Extract userId
  const userId = withAuth(event);

  // 2. Fetch items
  const items = await repo.listItems(userId);

  // 3. Return payload
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  };
});
