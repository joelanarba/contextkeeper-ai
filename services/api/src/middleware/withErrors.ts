import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { AppError } from '@contextkeeper/core';

type Handler = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => Promise<APIGatewayProxyResultV2>;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * Wrap a handler to catch typed errors and map them to HTTP responses.
 * AppError subclasses carry their own status code and machine-readable code.
 * Unknown errors become 500 with no stack trace exposed.
 */
export function withErrors(handler: Handler): Handler {
  return async (event) => {
    try {
      return await handler(event);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return {
          statusCode: error.statusCode,
          headers: JSON_HEADERS,
          body: JSON.stringify({
            error: { code: error.code, message: error.message },
          }),
        };
      }

      // Never log capture content. Log IDs and error names only.
      const requestId = event.requestContext.requestId;
      console.log(
        JSON.stringify({
          level: 'ERROR',
          msg: 'Unhandled error',
          requestId,
          errorName: error instanceof Error ? error.name : 'Unknown',
        }),
      );

      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        }),
      };
    }
  };
}
