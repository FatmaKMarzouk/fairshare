import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the containerised stack, not a dev server, so
 * what is verified is the artefact that actually ships.
 *
 * Bring the stack up first:
 *
 *   docker compose up -d --build
 *
 * `E2E_BASE_URL` overrides the target, which is how CI points the suite at the
 * stack it just built.
 */
export default defineConfig({
  testDir: './frontend/e2e',
  outputDir: './test-results',

  // A failing assertion in a shared-state app is usually a real bug rather than
  // a flake, so retry only on CI, where infrastructure noise is likelier.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
