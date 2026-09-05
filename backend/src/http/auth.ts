import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { Config } from '../config';
import { unauthenticated } from './errors';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

interface TokenPayload {
  sub: string;
}

export function signToken(config: Config, userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Requires a bearer token and puts the caller's id on the request.
 *
 * Every failure looks the same from outside: a missing header, a malformed
 * one, an expired token and a forged token are all simply unauthenticated.
 */
export function requireAuth(config: Config): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      next(unauthenticated());
      return;
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
      request.userId = payload.sub;
      next();
    } catch {
      next(unauthenticated('The token is not valid'));
    }
  };
}

/** The caller's id, for handlers that sit behind `requireAuth`. */
export function callerId(request: Request): string {
  if (!request.userId) {
    throw unauthenticated();
  }
  return request.userId;
}
