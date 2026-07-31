import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from '@contextkeeper/core';

/**
 * Extract the authenticated userId from the JWT authorizer claims.
 * userId comes from `event.requestContext.authorizer.jwt.claims.sub` and nowhere else.
 * See CLAUDE.md section 9.
 */
export function withAuth(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const sub = event.requestContext.authorizer.jwt.claims.sub;
  if (!sub || typeof sub !== 'string') {
    throw new ForbiddenError('Missing user identity');
  }
  return sub;
}
