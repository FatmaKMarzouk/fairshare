import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodTypeAny } from 'zod';

import { validationFailed } from './errors';

function describe(error: z.ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Replaces the request body with the parsed, narrowed value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(validationFailed('The request body is not valid', describe(result.error)));
      return;
    }

    request.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodTypeAny): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(validationFailed('The request path is not valid', describe(result.error)));
      return;
    }

    next();
  };
}

/**
 * A MongoDB identifier.
 *
 * Checked as a route parameter so that a malformed id is a 422 about the
 * request, rather than reaching the database and surfacing as a cast error.
 */
export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid identifier');
