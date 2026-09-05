import { Router } from 'express';
import { z } from 'zod';

import { Config } from '../config';
import { SPLIT_MODES } from '../domain/types';
import { handle } from '../http/async';
import { callerId, requireAuth } from '../http/auth';
import { objectId, validateBody, validateParams } from '../http/validate';
import * as expenseService from '../services/expense.service';
import * as groupService from '../services/group.service';

const groupSchema = z.object({
  name: z.string().trim().min(1, 'a name is required').max(120),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'must be a three letter currency code')
    .transform((value) => value.toUpperCase())
    .default('CHF'),
});

const memberSchema = z.object({
  email: z.string().trim().email('must be a valid email address'),
});

const expenseSchema = z.object({
  description: z.string().trim().min(1, 'a description is required').max(200),
  amountMinor: z
    .number()
    .int('must be a whole number of minor units')
    .positive('must be more than nothing'),
  paidBy: objectId,
  splitMode: z.enum(SPLIT_MODES),
  participants: z
    .array(z.object({ userId: objectId, value: z.number().optional() }))
    .min(1, 'at least one participant is required'),
  occurredAt: z.string().datetime().optional(),
});

const groupParams = z.object({ id: objectId });

export function groupRoutes(config: Config): Router {
  const router = Router();
  const authenticated = requireAuth(config);

  router.post(
    '/',
    authenticated,
    validateBody(groupSchema),
    handle(async (request, response) => {
      response.status(201).json(await groupService.createGroup(callerId(request), request.body));
    }),
  );

  router.get(
    '/',
    authenticated,
    handle(async (request, response) => {
      response.status(200).json({ groups: await groupService.listGroups(callerId(request)) });
    }),
  );

  router.get(
    '/:id',
    authenticated,
    validateParams(groupParams),
    handle(async (request, response) => {
      response.status(200).json(await groupService.getGroup(request.params.id, callerId(request)));
    }),
  );

  router.post(
    '/:id/members',
    authenticated,
    validateParams(groupParams),
    validateBody(memberSchema),
    handle(async (request, response) => {
      response
        .status(200)
        .json(
          await groupService.addMember(request.params.id, callerId(request), request.body.email),
        );
    }),
  );

  router.post(
    '/:id/expenses',
    authenticated,
    validateParams(groupParams),
    validateBody(expenseSchema),
    handle(async (request, response) => {
      response
        .status(201)
        .json(
          await expenseService.recordExpense(request.params.id, callerId(request), request.body),
        );
    }),
  );

  router.get(
    '/:id/expenses',
    authenticated,
    validateParams(groupParams),
    handle(async (request, response) => {
      response.status(200).json({
        expenses: await expenseService.listExpenses(request.params.id, callerId(request)),
      });
    }),
  );

  router.get(
    '/:id/balances',
    authenticated,
    validateParams(groupParams),
    handle(async (request, response) => {
      response.status(200).json({
        balances: await expenseService.getBalances(request.params.id, callerId(request)),
      });
    }),
  );

  router.get(
    '/:id/settlement',
    authenticated,
    validateParams(groupParams),
    handle(async (request, response) => {
      response.status(200).json({
        transfers: await expenseService.getSettlement(request.params.id, callerId(request)),
      });
    }),
  );

  return router;
}
