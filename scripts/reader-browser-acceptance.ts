import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type ReaderPlaywrightExecutor = (
  args: readonly string[],
  envOverrides?: NodeJS.ProcessEnv,
) => number;

export interface ReaderBrowserAcceptanceOptions {
  env?: NodeJS.ProcessEnv;
  executePlaywright?: ReaderPlaywrightExecutor;
  stdout?: (line: string) => void;
}

function executeLocalPlaywright(
  args: readonly string[],
  envOverrides: NodeJS.ProcessEnv = {},
): number {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmCommand, ['exec', 'playwright', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...envOverrides },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Runs representative fixture acceptance first, then the intermediate and
 * sparse Home scenarios, then the canonical generated catalog smoke. Every
 * invocation is intentionally sequential so Vite/SvelteKit output directories
 * cannot cross-talk.
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

  if (env.PLAYWRIGHT_BROWSERS_PREINSTALLED !== '1') {
    const provisionExitCode = executePlaywright(['install', 'chromium']);
    if (provisionExitCode !== 0) return provisionExitCode;
  }

  const fixtureRuns: ReadonlyArray<{
    scenario: 'representative' | 'intermediate' | 'sparse';
    args: readonly string[];
  }> = [
    {
      scenario: 'representative',
      args: ['test', '-c', 'apps/web/playwright.reader.config.ts'],
    },
    {
      scenario: 'intermediate',
      args: [
        'test',
        '-c',
        'apps/web/playwright.reader.config.ts',
        '--grep',
        '@home-catalog-scenario',
      ],
    },
    {
      scenario: 'sparse',
      args: [
        'test',
        '-c',
        'apps/web/playwright.reader.config.ts',
        '--grep',
        '@home-catalog-scenario',
      ],
    },
  ];

  for (const fixtureRun of fixtureRuns) {
    const fixtureExitCode = executePlaywright(fixtureRun.args, {
      READER_ACCEPTANCE_SCENARIO: fixtureRun.scenario,
    });
    if (fixtureExitCode !== 0) return fixtureExitCode;
  }

  return executePlaywright(['test', '-c', 'apps/web/playwright.reader-smoke.config.ts']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runReaderBrowserAcceptance();
  if (exitCode !== 0) process.exitCode = exitCode;
}
