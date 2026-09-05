import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards a rejected promise to the error handler.
 *
 * Express 4 only catches what a handler throws synchronously; an async handler
 * that rejects would otherwise hang the request until it timed out, with the
 * cause reported nowhere. Every async route below is wrapped in this.
 */
export function handle(
  fn: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    fn(request, response).catch(next);
  };
}
