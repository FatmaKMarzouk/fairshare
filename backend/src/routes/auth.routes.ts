import { Router } from 'express';
import { z } from 'zod';

import { Config } from '../config';
import { handle } from '../http/async';
import { callerId, requireAuth } from '../http/auth';
import { validateBody } from '../http/validate';
import * as authService from '../services/auth.service';

const registrationSchema = z.object({
  name: z.string().trim().min(1, 'a name is required').max(120),
  email: z.string().trim().email('must be a valid email address'),
  password: z.string().min(8, 'must be at least 8 characters').max(200),
});

const credentialsSchema = z.object({
  email: z.string().trim().email('must be a valid email address'),
  password: z.string().min(1, 'a password is required'),
});

export function authRoutes(config: Config): Router {
  const router = Router();

  router.post(
    '/register',
    validateBody(registrationSchema),
    handle(async (request, response) => {
      response.status(201).json(await authService.register(config, request.body));
    }),
  );

  router.post(
    '/login',
    validateBody(credentialsSchema),
    handle(async (request, response) => {
      response.status(200).json(await authService.login(config, request.body));
    }),
  );

  router.get(
    '/me',
    requireAuth(config),
    handle(async (request, response) => {
      response.status(200).json({ user: await authService.currentUser(callerId(request)) });
    }),
  );

  return router;
}
