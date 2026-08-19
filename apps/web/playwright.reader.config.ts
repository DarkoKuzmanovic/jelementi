import { defineConfig, devices } from '@playwright/test';

const REPRESENTATIVE_PORT = 44_103;
const ORDINARY_ERROR_PORT = 44_104;
const RETRYABLE_ERROR_PORT = 44_105;
const representativeBaseUrl = `http://127.0.0.1:${REPRESENTATIVE_PORT}`;
const ordinaryErrorBaseUrl = `http://127.0.0.1:${ORDINARY_ERROR_PORT}`;
const retryableErrorBaseUrl = `http://127.0.0.1:${RETRYABLE_ERROR_PORT}`;
const normalTests = /reader-(?!ordinary-error).*\.spec\.ts/;
const ordinaryErrorTest = 'reader-ordinary-error.spec.ts';

/** Deterministic Reader fixture seam: actual SvelteKit routes, test-only catalog. */
export default defineConfig({
  testDir: './tests/reader-acceptance',
  testMatch: [normalTests, ordinaryErrorTest],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'reader-js-enabled',
      testMatch: normalTests,
      use: { ...devices['Desktop Chrome'], baseURL: representativeBaseUrl },
    },
    {
      name: 'reader-no-js',
      testMatch: normalTests,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: representativeBaseUrl,
        javaScriptEnabled: false,
      },
    },
    {
      name: 'reader-ordinary-error',
      testMatch: ordinaryErrorTest,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ordinaryErrorBaseUrl,
        javaScriptEnabled: false,
      },
    },
    {
      name: 'reader-retryable-error',
      testMatch: ordinaryErrorTest,
      use: { ...devices['Desktop Chrome'], baseURL: retryableErrorBaseUrl },
    },
  ],
  webServer: [
    {
      command: `pnpm exec vite dev --config vite.reader-acceptance.config.ts --host 127.0.0.1 --port ${REPRESENTATIVE_PORT}`,
      env: { READER_ACCEPTANCE_SCENARIO: 'representative' },
      port: REPRESENTATIVE_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite dev --config vite.reader-acceptance.config.ts --host 127.0.0.1 --port ${ORDINARY_ERROR_PORT}`,
      env: { READER_ACCEPTANCE_SCENARIO: 'ordinary-error' },
      url: `${ordinaryErrorBaseUrl}/about`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite dev --config vite.reader-acceptance.config.ts --host 127.0.0.1 --port ${RETRYABLE_ERROR_PORT}`,
      env: { READER_ACCEPTANCE_SCENARIO: 'retryable-error' },
      url: `${retryableErrorBaseUrl}/about`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
