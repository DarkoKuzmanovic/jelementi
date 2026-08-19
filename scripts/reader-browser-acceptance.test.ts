import { describe, expect, it, vi } from 'vitest';
import { runReaderBrowserAcceptance } from './reader-browser-acceptance';

describe('Reader browser acceptance execution seam', () => {
  it('skips browser subprocesses only for exact Workers Builds execution', () => {
    const executePlaywright = vi.fn(() => 0);
    const stdout = vi.fn();

    expect(
      runReaderBrowserAcceptance({
        env: { WORKERS_CI: '1' },
        executePlaywright,
        stdout,
      }),
    ).toBe(0);
    expect(executePlaywright).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      expect.stringMatching(/Reader browser acceptance: SKIPPED.*WORKERS_CI=1/),
    );
  });

  it('runs representative, intermediate, sparse, and real generated-content browser surfaces', () => {
    const executePlaywright = vi.fn(() => 0);

    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright })).toBe(0);
    expect(executePlaywright.mock.calls).toEqual([
      [['install', 'chromium']],
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts'],
        { READER_ACCEPTANCE_SCENARIO: 'representative' },
      ],
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts', '--grep', '@home-catalog-scenario'],
        { READER_ACCEPTANCE_SCENARIO: 'intermediate' },
      ],
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts', '--grep', '@home-catalog-scenario'],
        { READER_ACCEPTANCE_SCENARIO: 'sparse' },
      ],
      [['test', '-c', 'apps/web/playwright.reader-smoke.config.ts']],
    ]);
  });

  it('does not provision Chromium again when CI explicitly preinstalled it', () => {
    const executePlaywright = vi.fn(() => 0);

    expect(
      runReaderBrowserAcceptance({
        env: { PLAYWRIGHT_BROWSERS_PREINSTALLED: '1' },
        executePlaywright,
      }),
    ).toBe(0);
    expect(executePlaywright.mock.calls).toEqual([
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts'],
        { READER_ACCEPTANCE_SCENARIO: 'representative' },
      ],
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts', '--grep', '@home-catalog-scenario'],
        { READER_ACCEPTANCE_SCENARIO: 'intermediate' },
      ],
      [
        ['test', '-c', 'apps/web/playwright.reader.config.ts', '--grep', '@home-catalog-scenario'],
        { READER_ACCEPTANCE_SCENARIO: 'sparse' },
      ],
      [['test', '-c', 'apps/web/playwright.reader-smoke.config.ts']],
    ]);
  });

  it('does not trust a non-exact preinstalled marker', () => {
    const executePlaywright = vi.fn(() => 0);

    expect(
      runReaderBrowserAcceptance({
        env: { PLAYWRIGHT_BROWSERS_PREINSTALLED: 'true' },
        executePlaywright,
      }),
    ).toBe(0);
    expect(executePlaywright.mock.calls[0]).toEqual([['install', 'chromium']]);
  });

  it('stops at the first failed browser phase', () => {
    const fixtureFailure = vi
      .fn<(args: readonly string[]) => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(19);
    const smokeFailure = vi
      .fn<(args: readonly string[]) => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(23);

    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright: fixtureFailure })).toBe(19);
    expect(fixtureFailure).toHaveBeenCalledTimes(2);
    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright: smokeFailure })).toBe(23);
  });
});
