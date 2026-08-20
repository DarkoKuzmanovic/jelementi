import { describe, expect, it } from 'vitest';
import {
  assertAmendedLighthouseContract,
  assertLighthouseThresholds,
  getCurrentHead,
  getFailedSeoAuditIds,
  getFailedSeoAudits,
  isGlobalNoindexPresent,
  isNoindexPresentInHtml,
} from './run-lighthouse';
import { spawnSync } from 'node:child_process';

function makeLhr(
  failedIds: string[],
  opts?: {
    extraManualIds?: string[];
    extraNotApplicableIds?: string[];
    extraInformativeIds?: string[];
  },
): unknown {
  const allAuditIds = [
    ...failedIds,
    'document-title',
    'meta-description',
    'crawlable-anchors',
    'is-crawlable',
    'structured-data',
  ].filter((v, i, a) => a.indexOf(v) === i);
  // Build auditRefs for all ids we want considered applicable, plus extra manual/notApplicable to ensure they are ignored.
  const auditRefs = allAuditIds.map((id) => ({ id, weight: 1 }));
  const audits: Record<string, unknown> = {};
  for (const id of allAuditIds) {
    const isFailed = failedIds.includes(id);
    audits[id] = {
      id,
      title: id,
      score: isFailed ? 0 : 1,
      scoreDisplayMode: 'binary',
      description: `${id} description`,
    };
  }
  for (const id of opts?.extraManualIds ?? []) {
    audits[id] = { id, title: id, score: null, scoreDisplayMode: 'manual', description: 'manual' };
    auditRefs.push({ id, weight: 0 });
  }
  for (const id of opts?.extraNotApplicableIds ?? []) {
    audits[id] = {
      id,
      title: id,
      score: null,
      scoreDisplayMode: 'notApplicable',
      description: 'na',
    };
    auditRefs.push({ id, weight: 0 });
  }
  for (const id of opts?.extraInformativeIds ?? []) {
    audits[id] = {
      id,
      title: id,
      score: null,
      scoreDisplayMode: 'informative',
      description: 'informative',
    };
    auditRefs.push({ id, weight: 0 });
  }
  return {
    categories: { seo: { auditRefs } },
    audits,
    lighthouseVersion: '13.4.1',
  };
}

describe('run-lighthouse', () => {
  it('derives commit from actual HEAD', () => {
    const actual = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    expect(getCurrentHead()).toBe(actual);
  });

  it('requires Accessibility/Best Practices 100 and Performance >=90', () => {
    const okLhr = makeLhr(['is-crawlable']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 90 },
        okLhr,
      ),
    ).not.toThrow();
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 99, bestPractices: 100, seo: 60, performance: 90 },
        okLhr,
      ),
    ).toThrow(/Accessibility/);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 89 },
        okLhr,
      ),
    ).toThrow(/Performance/);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 99, seo: 60, performance: 90 },
        okLhr,
      ),
    ).toThrow(/Best Practices/);
  });

  it('fails closed on noisy performance rather than waiving', () => {
    const okLhr = makeLhr(['is-crawlable']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 85 },
        okLhr,
      ),
    ).toThrow(/< 90/);
  });

  it('parses failed applicable SEO audits and ignores manual/notApplicable/informative', () => {
    const lhr = makeLhr(['is-crawlable'], {
      extraManualIds: ['manual-audit'],
      extraNotApplicableIds: ['na-audit'],
      extraInformativeIds: ['informative-audit'],
    });
    expect(getFailedSeoAuditIds(lhr)).toEqual(['is-crawlable']);
    expect(getFailedSeoAudits(lhr).map((a) => a.id)).toEqual(['is-crawlable']);
  });

  it('fails closed on malformed LHR (missing categories/audits/seo/auditRefs)', () => {
    expect(() => getFailedSeoAudits({} as unknown)).toThrow(/missing categories/);
    expect(() => getFailedSeoAudits({ categories: {} } as unknown)).toThrow(/missing audits/);
    expect(() => getFailedSeoAudits({ categories: {}, audits: {} } as unknown)).toThrow(
      /missing seo category/,
    );
    expect(() => getFailedSeoAudits({ categories: { seo: {} }, audits: {} } as unknown)).toThrow(
      /missing auditRefs/,
    );
    expect(() =>
      getFailedSeoAudits({
        categories: { seo: { auditRefs: [{ id: 'is-crawlable' }] } },
        audits: {},
      } as unknown),
    ).toThrow(/missing audit record/);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 100 },
        {} as unknown,
      ),
    ).toThrow(/Lighthouse LHR/);
  });

  it('blocks inconsistent is-crawlable with SEO 100 (guard before PASS)', () => {
    const lhr = makeLhr(['is-crawlable']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 100, performance: 100 },
        lhr,
      ),
    ).toThrow(/inconsistent LHR/);
  });

  it('amended contract: sole is-crawlable failure with SEO 60 passes (unlisted-beta)', () => {
    const lhr = makeLhr(['is-crawlable']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 100 },
        lhr,
      ),
    ).not.toThrow();
    // Also assert legacy wrapper with lhr delegates to amended
    expect(() =>
      assertLighthouseThresholds(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 100 },
        lhr,
      ),
    ).not.toThrow();
  });

  it('amended contract: future SEO 100 with no failed audits passes (global noindex retired)', () => {
    const lhr = makeLhr([]);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 100, performance: 100 },
        lhr,
        { globalNoindexPresent: false },
      ),
    ).not.toThrow();
  });

  it('future phase blocks sole is-crawlable when global noindex retired', () => {
    const lhr = makeLhr(['is-crawlable']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 100 },
        lhr,
        { globalNoindexPresent: false },
      ),
    ).toThrow(/global noindex retired/);
  });

  it('blocks any second failed SEO audit alongside is-crawlable (does not merely lower threshold)', () => {
    const lhr = makeLhr(['is-crawlable', 'document-title']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 50, performance: 100 },
        lhr,
      ),
    ).toThrow(/must be exactly \[is-crawlable\]/);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 50, performance: 100 },
        lhr,
      ),
    ).toThrow(/is-crawlable/);
  });

  it('blocks meta-description or other single non-is-crawlable failure', () => {
    const lhr = makeLhr(['meta-description']);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 90, performance: 100 },
        lhr,
      ),
    ).toThrow(/must be exactly \[is-crawlable\]/);
  });

  it('blocks SEO 90 with no failed audits (future contract requires 100)', () => {
    const lhr = makeLhr([]);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 90, performance: 100 },
        lhr,
      ),
    ).toThrow(/SEO score 90/);
  });

  it('blocks SEO 60 with no failed audits (inconsistent — must record exact audit set)', () => {
    const lhr = makeLhr([]);
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 60, performance: 100 },
        lhr,
      ),
    ).toThrow(/no failed applicable SEO audits but SEO score 60/);
  });

  it('legacy assertLighthouseThresholds without LHR still requires SEO 100 (strict)', () => {
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
        accessibility: 100,
        bestPractices: 100,
        seo: 60,
        performance: 90,
      }),
    ).toThrow(/SEO/);
  });

  it('detects global noindex via exact meta robots directive, not incidental mention', () => {
    // Current unlisted-beta has <meta name="robots" content="noindex" /> in app.html
    expect(isGlobalNoindexPresent()).toBe(true);
    expect(isNoindexPresentInHtml('<meta name="robots" content="noindex" />')).toBe(true);
    expect(isNoindexPresentInHtml('<meta content="noindex" name="robots">')).toBe(true);
    expect(isNoindexPresentInHtml('<meta name="robots" content="noindex-other">')).toBe(false);
    expect(isNoindexPresentInHtml('<!-- <meta name="robots" content="noindex"> -->')).toBe(false);
    expect(isNoindexPresentInHtml('<!-- noindex -->')).toBe(false);
    expect(isNoindexPresentInHtml('<meta name="viewport" content="width=device-width">')).toBe(
      false,
    );
    // Must not match non-meta tags or inert script/template text
    expect(isNoindexPresentInHtml('<metadata name="robots" content="noindex">')).toBe(false);
    expect(
      isNoindexPresentInHtml(
        '<script>const x = "<meta name=\\"robots\\" content=\\"noindex\\">";</script>',
      ),
    ).toBe(false);
    expect(
      isNoindexPresentInHtml('<template><meta name="robots" content="noindex"></template>'),
    ).toBe(false);
    expect(isNoindexPresentInHtml('<meta data-name="robots" data-content="noindex">')).toBe(false);
    expect(isNoindexPresentInHtml('<meta data-note=\' name="robots" content="noindex"\' >')).toBe(
      false,
    );
    expect(isNoindexPresentInHtml('<meta name="robots" content="noindex" data-extra="x">')).toBe(
      true,
    );
  });

  it('blocks future SEO 100 with no failures when global noindex is still present (must be is-crawlable)', () => {
    const lhr = makeLhr([]);
    // Without override, isGlobalNoindexPresent() is true (meta present), so empty
    // with SEO 100 should fail — during beta, is-crawlable must be sole failed.
    expect(() =>
      assertAmendedLighthouseContract(
        { accessibility: 100, bestPractices: 100, seo: 100, performance: 100 },
        lhr,
      ),
    ).toThrow(/global noindex present.*must be exactly \[is-crawlable\]/);
  });
});
