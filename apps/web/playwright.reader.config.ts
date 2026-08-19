import { defineConfig, devices } from '@playwright/test';

const PORT = Number.parseInt(process.env.READER_ACCEPTANCE_PORT ?? '4321', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const scenario = process.env.READER_ACCEPTANCE_SCENARIO ?? 'representative';

/** Deterministic Reader fixture seam: actual SvelteKit routes, test-only catalog. */
export default defineConfig({
  testDir: './tests/reader-acceptance',
  testMatch: /reader-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'reader-js-enabled',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'reader-no-js',
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
  ],
  webServer: {
    command: `pnpm exec vite dev --config vite.reader-acceptance.config.ts --host 127.0.0.1 --port ${PORT}`,
    env: { READER_ACCEPTANCE_SCENARIO: scenario },
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
