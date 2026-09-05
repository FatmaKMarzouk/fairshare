import mongoose from 'mongoose';

type MemoryServer = { getUri(): string; stop(): Promise<boolean> };

let memoryServer: MemoryServer | undefined;

/**
 * Connects the test suite to a database.
 *
 * `TEST_MONGO_URL` wins if it is set, which is how CI points the suite at a
 * real MongoDB service container. Otherwise an in-process server is started so
 * that `npm test` works on a machine with nothing installed.
 */
export async function connectTestDb(): Promise<void> {
  const configured = process.env.TEST_MONGO_URL;

  if (configured) {
    await mongoose.connect(configured, { dbName: `fairshare_test_${process.pid}` });
    return;
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'fairshare_test' });
}

/** Empties every collection, so one test cannot see another's data. */
export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
