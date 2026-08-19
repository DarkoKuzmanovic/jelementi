import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type ReaderPlaywrightExecutor = (args: readonly string[]) => number;

export interface ReaderBrowserAcceptanceOptions {
  env?: NodeJS.ProcessEnv;
  executePlaywright?: ReaderPlaywrightExecutor;
  stdout?: (line: string) => void;
}

function executeLocalPlaywright(args: readonly string[]): number {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmCommand, ['exec', 'playwright', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Runs deterministic fixture acceptance first and the canonical generated
 * catalog smoke second. The two Playwright invocations are intentionally
 * sequential so their Vite/SvelteKit output directories cannot cross-talk.
 */
export function runReaderBrowserAcceptance({
  env = process.env,
  executePlaywright = executeLocalPlaywright,
  stdout = console.log,
}: ReaderBrowserAcceptanceOptions = {}): number {
  if (env.WORKERS_CI === '1') {
    stdout(
      'Reader browser acceptance: SKIPPED for Cloudflare Workers Builds (WORKERS_CI=1); all non-browser gates continue.',
    );
    return 0;
  }

  const provisionExitCode = executePlaywright(['install', 'chromium']);
  if (provisionExitCode !== 0) return provisionExitCode;

  const fixtureExitCode = executePlaywright(['test', '-c', 'apps/web/playwright.reader.config.ts']);
  if (fixtureExitCode !== 0) return fixtureExitCode;

  return executePlaywright(['test', '-c', 'apps/web/playwright.reader-smoke.config.ts']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runReaderBrowserAcceptance();
  if (exitCode !== 0) process.exitCode = exitCode;
}
