import { withAuth } from '../middleware/withAuth.js';
import { withErrors } from '../middleware/withErrors.js';

export const handler = withErrors(async (event) => {
  const userId = withAuth(event);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', userId }),
  };
});
