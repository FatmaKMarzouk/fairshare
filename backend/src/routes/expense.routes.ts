import { Router } from 'express';
import { z } from 'zod';

import { Config } from '../config';
import { handle } from '../http/async';
import { callerId, requireAuth } from '../http/auth';
import { objectId, validateParams } from '../http/validate';
import * as expenseService from '../services/expense.service';

const expenseParams = z.object({ id: objectId });

export function expenseRoutes(config: Config): Router {
  const router = Router();

  router.delete(
    '/:id',
    requireAuth(config),
    validateParams(expenseParams),
    handle(async (request, response) => {
      await expenseService.deleteExpense(request.params.id, callerId(request));
      response.status(204).send();
    }),
  );

  return router;
}
