import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

/** Separate smoke surface using only canonical generated content and normal Vite config. */
export default defineConfig({
  testDir: './tests/reader-acceptance',
  testMatch: 'reader-real-catalog.spec.ts',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'reader-real-generated-catalog' }],
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
