import { describe, expect, it } from 'vitest';
import { assertLighthouseThresholds, getCurrentHead } from './run-lighthouse';
import { spawnSync } from 'node:child_process';

describe('run-lighthouse', () => {
  it('derives commit from actual HEAD', () => {
    const actual = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    expect(getCurrentHead()).toBe(actual);
  });

  it('requires Accessibility/Best Practices/SEO 100 and Performance >=90', () => {
    expect(() =>
      assertLighthouseThresholds({
        accessibility: 100,
        bestPractices: 100,
        seo: 100,
        performance: 90,
      }),
    ).not.toThrow();
    expect(() =>
      assertLighthouseThresholds({
        accessibility: 99,
        bestPractices: 100,
        seo: 100,
        performance: 90,
      }),
    ).toThrow(/Accessibility/);
    expect(() =>
      assertLighthouseThresholds({
        accessibility: 100,
        bestPractices: 100,
        seo: 100,
        performance: 89,
      }),
    ).toThrow(/Performance/);
  });

  it('fails closed on noisy performance rather than waiving', () => {
    expect(() =>
      assertLighthouseThresholds({
        accessibility: 100,
        bestPractices: 100,
        seo: 100,
        performance: 85,
      }),
    ).toThrow(/< 90/);
  });
});
