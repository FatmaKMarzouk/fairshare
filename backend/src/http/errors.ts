import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { DomainError } from '../domain/types';

/** An error that already knows how it should look on the wire. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const unauthenticated = (message = 'Authentication is required'): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', message);

export const notFound = (message = 'Not found'): ApiError =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string): ApiError =>
  new ApiError(409, code, message);

export const validationFailed = (message: string, details: unknown[] = []): ApiError =>
  new ApiError(422, 'VALIDATION_FAILED', message, details);

/** Anything that falls through every route. */
export function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'No such endpoint', details: [] },
  });
}

/**
 * Translates every kind of failure into one response shape.
 *
 * A DomainError becomes a 422 carrying its own code, so a client can react to
 * the specific problem — an exact split that does not add up, say — rather than
 * matching on prose.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  // Express only recognises an error handler by its arity, so this stays.
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    response
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request body is not valid',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    response
      .status(422)
      .json({ error: { code: error.code, message: error.message, details: [] } });
    return;
  }

  // Nothing below here is expected, so it is logged rather than swallowed, and
  // the client is told nothing about the internals.
  console.error('Unhandled error', error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', details: [] },
  });
}
