/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    // The domain engines carry the interesting logic, so they are held to a
    // far higher bar than the thin plumbing around them.
    './src/domain/': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
  },
  // mongodb-memory-server can be slow to spin up the first time it runs.
  testTimeout: 30000,
};
