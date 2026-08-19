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

  it('runs fixture JS/no-JS acceptance and the real generated-content smoke path', () => {
    const executePlaywright = vi.fn(() => 0);

    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright })).toBe(0);
    expect(executePlaywright.mock.calls).toEqual([
      [['install', 'chromium']],
      [['test', '-c', 'apps/web/playwright.reader.config.ts']],
      [['test', '-c', 'apps/web/playwright.reader-smoke.config.ts']],
    ]);
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
      .mockReturnValueOnce(23);

    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright: fixtureFailure })).toBe(19);
    expect(fixtureFailure).toHaveBeenCalledTimes(2);
    expect(runReaderBrowserAcceptance({ env: {}, executePlaywright: smokeFailure })).toBe(23);
  });
});
