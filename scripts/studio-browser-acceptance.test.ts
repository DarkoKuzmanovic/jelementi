import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { runStudioBrowserAcceptance } from './studio-browser-acceptance';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { scripts?: Record<string, string> };

const browserGate = rootPackageJson.scripts?.['test:studio:browser'] ?? '';
const verifyDeploy = rootPackageJson.scripts?.['verify:deploy'] ?? '';
const ciWorkflow = readFileSync(
  fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)),
  'utf8',
);
const activeCiLines = ciWorkflow.split('\n').filter((line) => !line.trimStart().startsWith('#'));
const ciRunSteps = activeCiLines.flatMap((line) => {
  const match = /^\s+(?:-\s+)?run:\s*(\S.*)$/.exec(line);
  return match?.[1] ? [match[1]] : [];
});

/**
 * Studio browser acceptance seam (#73) — execution contract.
 *
 * Browser acceptance remains mandatory in ordinary and GitHub verification.
 * Cloudflare Workers Builds is the one explicit exception because its build
 * image cannot launch Chromium. The exception belongs to the browser gate,
 * is selected only by Cloudflare's documented WORKERS_CI=1 value, and must
 * never bypass another segment of the canonical deployment gate.
 */
describe('Studio browser acceptance execution seam', () => {
  it('skips browser subprocesses only for exact Workers Builds execution', () => {
    const executePlaywright = vi.fn(() => 0);
    const stdout = vi.fn();

    expect(
      runStudioBrowserAcceptance({
        env: { WORKERS_CI: '1' },
        executePlaywright,
        stdout,
      }),
    ).toBe(0);
    expect(executePlaywright).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      expect.stringMatching(/Studio browser acceptance: SKIPPED.*WORKERS_CI=1/),
    );
  });

  it.each([
    ['ordinary local execution', {}],
    ['GitHub CI execution', { CI: 'true' }],
    ['a blank Workers value', { WORKERS_CI: '' }],
    ['a different Workers value', { WORKERS_CI: 'true' }],
    ['a non-exact preinstalled marker', { PLAYWRIGHT_BROWSERS_PREINSTALLED: 'true' }],
  ])('runs version-aligned Chromium acceptance for %s', (_label, env) => {
    const executePlaywright = vi.fn(() => 0);

    expect(runStudioBrowserAcceptance({ env, executePlaywright })).toBe(0);
    expect(executePlaywright.mock.calls).toEqual([
      [['install', 'chromium']],
      [['test', '-c', 'apps/web/playwright.config.ts']],
    ]);
  });

  it('does not provision Chromium again when CI explicitly preinstalled it', () => {
    const executePlaywright = vi.fn(() => 0);

    expect(
      runStudioBrowserAcceptance({
        env: { PLAYWRIGHT_BROWSERS_PREINSTALLED: '1' },
        executePlaywright,
      }),
    ).toBe(0);
    expect(executePlaywright.mock.calls).toEqual([
      [['test', '-c', 'apps/web/playwright.config.ts']],
    ]);
  });

  it('fails the gate when provisioning or browser acceptance fails', () => {
    const provisioningFailure = vi
      .fn<(args: readonly string[]) => number>()
      .mockReturnValueOnce(17);
    const acceptanceFailure = vi
      .fn<(args: readonly string[]) => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(23);

    expect(runStudioBrowserAcceptance({ env: {}, executePlaywright: provisioningFailure })).toBe(
      17,
    );
    expect(provisioningFailure).toHaveBeenCalledTimes(1);
    expect(runStudioBrowserAcceptance({ env: {}, executePlaywright: acceptanceFailure })).toBe(23);
  });

  it('executes the package-script entrypoint and makes the Workers skip visible', () => {
    const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const result = spawnSync(pnpmCommand, ['test:studio:browser'], {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: { ...process.env, WORKERS_CI: '1' },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Studio browser acceptance: SKIPPED.*WORKERS_CI=1/);
  });

  it('keeps the guarded browser gate inside the canonical verify:deploy chain', () => {
    expect(verifyDeploy.split(' && ')).toContain('pnpm test:studio:browser');
    expect(browserGate).toBe('tsx scripts/studio-browser-acceptance.ts');
  });

  it('keeps GitHub required verification provisioned, bounded, and routed through the canonical gate', () => {
    const installCommand = 'pnpm exec playwright install --with-deps --only-shell chromium';

    expect(activeCiLines).toContain('concurrency:');
    expect(activeCiLines).toContain('  cancel-in-progress: true');
    expect(activeCiLines).toContain('    timeout-minutes: 15');
    expect(activeCiLines).toContain("      PLAYWRIGHT_BROWSERS_PREINSTALLED: '1'");
    expect(activeCiLines).toContain('        timeout-minutes: 5');
    expect(ciRunSteps).toContain(installCommand);
    expect(ciRunSteps.at(-1)).toBe('pnpm verify:deploy');
    expect(ciRunSteps.indexOf(installCommand)).toBeLessThan(
      ciRunSteps.indexOf('pnpm verify:deploy'),
    );
    expect(activeCiLines.join('\n')).not.toMatch(/\bWORKERS_CI\b/);
  });
});
