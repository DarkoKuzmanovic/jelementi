import { defineConfig, devices } from '@playwright/test';

/**
 * Studio browser acceptance seam (#73).
 *
 * Runs the actual SvelteKit dev server (`vite dev`) on loopback with
 * `STUDIO_ACCEPTANCE_MODE=1` — the same explicit opt-in binding that gates
 * the deterministic fake GitHub adapter (`acceptance-bootstrap.server.ts`)
 * and the bounded test-identity bypass (`request-guard.server.ts`). Real
 * production Wrangler configuration never defines this binding.
 *
 * The dev server is served over HTTPS with a throwaway self-signed
 * loopback certificate (see `vite.config.ts`) because `PRODUCTION_ORIGIN`
 * — which `checkStudioOrigin` requires every Studio mutation's `Origin`
 * header to match exactly — must itself be a real `https:` URL
 * (`config.server.ts` fails closed on anything else). `ignoreHTTPSErrors`
 * below is what lets the browser accept that certificate.
 *
 * One bundled headless Chromium project exercises the ordinary,
 * JS-enabled path; a second Chromium project with JS disabled proves the
 * same routes and the same ordinary `<form method="POST">` submissions
 * work with no client script at all — matching `csr = false` on every
 * Studio route today.
 */

const PORT = 4319;
const BASE_URL = `https://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/studio-acceptance',
  fullyParallel: false,
  // The deterministic fake GitHub adapter is one shared, mutable in-memory
  // world seeded once per dev-server process (acceptance-bootstrap.server.ts)
  // — exactly like the real GitHub repository it stands in for. Running
  // more than one worker would let a mutation from one project (e.g. Save)
  // race a concurrent read/mutation in the other, which is a fixture
  // concurrency artifact, not a real product behavior to test for. The
  // suite is small; serial execution keeps every test deterministic.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'studio-js-enabled',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'studio-no-js',
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
  ],
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${PORT}`,
    env: { STUDIO_ACCEPTANCE_MODE: '1' },
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
