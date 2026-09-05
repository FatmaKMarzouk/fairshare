import mongoose from 'mongoose';

import { createApp } from './app';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.mongoUrl) {
    throw new Error('MONGO_URL is required to start the server');
  }

  await mongoose.connect(config.mongoUrl);
  console.info('Connected to MongoDB');

  const server = createApp(config).listen(config.port, () => {
    console.info(`FairShare API listening on port ${config.port}`);
  });

  // Compose sends SIGTERM on `down`; closing cleanly avoids dropping requests
  // that are already in flight.
  const shutdown = (signal: string): void => {
    console.info(`${signal} received, shutting down`);
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start', error);
  process.exit(1);
});
