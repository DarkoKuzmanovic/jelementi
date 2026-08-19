import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type PlaywrightExecutor = (args: readonly string[]) => number;

export interface StudioBrowserAcceptanceOptions {
  env?: NodeJS.ProcessEnv;
  executePlaywright?: PlaywrightExecutor;
  stdout?: (line: string) => void;
}

function executeLocalPlaywright(args: readonly string[]): number {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmCommand, ['exec', 'playwright', ...args], {
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Runs the Studio browser acceptance gate everywhere except the documented
 * Cloudflare Workers Builds environment. No other WORKERS_CI value opts out.
 */
export function runStudioBrowserAcceptance({
  env = process.env,
  executePlaywright = executeLocalPlaywright,
  stdout = console.log,
}: StudioBrowserAcceptanceOptions = {}): number {
  if (env.WORKERS_CI === '1') {
    stdout(
      'Studio browser acceptance: SKIPPED for Cloudflare Workers Builds (WORKERS_CI=1); all other verify:deploy checks continue.',
    );
    return 0;
  }

  if (env.PLAYWRIGHT_BROWSERS_PREINSTALLED !== '1') {
    const provisionExitCode = executePlaywright(['install', 'chromium']);
    if (provisionExitCode !== 0) return provisionExitCode;
  }

  return executePlaywright(['test', '-c', 'apps/web/playwright.config.ts']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runStudioBrowserAcceptance();
  if (exitCode !== 0) process.exitCode = exitCode;
}
