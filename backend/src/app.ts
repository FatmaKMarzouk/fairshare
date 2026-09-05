import express, { Express } from 'express';

/**
 * Builds the Express application.
 *
 * Deliberately does not listen on a port: `server.ts` owns that, so tests can
 * import and drive the app without binding anything.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use((_request, response) => {
    response.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: 'This endpoint is not implemented yet' },
    });
  });

  return app;
}
