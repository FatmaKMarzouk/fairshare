import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { Config, loadConfig } from './config';
import { errorHandler, notFoundHandler } from './http/errors';
import { authRoutes } from './routes/auth.routes';
import { expenseRoutes } from './routes/expense.routes';
import { groupRoutes } from './routes/group.routes';

/**
 * Builds the Express application.
 *
 * Deliberately does not listen on a port: `server.ts` owns that, so integration
 * tests can import and drive the app without binding anything.
 */
export function createApp(config: Config = loadConfig()): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes(config));
  app.use('/api/groups', groupRoutes(config));
  app.use('/api/expenses', expenseRoutes(config));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
