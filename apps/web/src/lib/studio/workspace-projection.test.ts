import { describe, expect, it } from 'vitest';
import {
  formatStudioVerifiedAt,
  STUDIO_PUBLISHED_VERSION_LABELS,
  STUDIO_WORKING_CHANGE_LABELS,
  buildStudioWorkspaceProjection,
  decodeStudioWorkspaceProjection,
  type StudioWorkspaceProjection,
} from './workspace-projection';
import { STUDIO_STATUS_KINDS, type StudioLifecycle } from './contracts';

const article = {
  slug: 'tristan-da-cunha',
  title: 'Tristan da Cunha',
  status: 'published' as const,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const branch = {
  name: 'studio/article/tristan-da-cunha',
  url: 'https://github.com/example/example/tree/studio/article/tristan-da-cunha',
  headSha: 'a'.repeat(40),
};

const pullRequest = {
  number: 12,
  url: 'https://github.com/example/example/pull/12',
  headSha: 'b'.repeat(40),
};

const concurrency = { baseMainSha: 'c'.repeat(40), draftHeadSha: 'd'.repeat(40) };

/** One representative lifecycle per kind — enough shape to build a projection. */
function lifecycleFor(kind: (typeof STUDIO_STATUS_KINDS)[number]): StudioLifecycle {
  switch (kind) {
    case 'draft_invalid':
      return {
        kind,
        article: { ...article, status: 'draft' },
        branch,
        issues: [{ code: 'x', message: 'bad', sourcePath: 'metadata.title' }],
      };
    case 'draft_valid':
      return { kind, article: { ...article, status: 'draft' }, branch };
    case 'ready':
    case 'checking':
      return { kind, article, pullRequest };
    case 'check_failed':
      return { kind, article, pullRequest, failedCheck: { name: 'ci' } };
    case 'merged':
    case 'pending_deployment':
    case 'unpublish_pending':
    case 'archived':
    case 'unverified':
      return { kind, article, mainSha: 'e'.repeat(40) };
    case 'live':
      return {
        kind,
        article,
        mainSha: 'e'.repeat(40),
        contentVersion: 'f'.repeat(64),
        expected: indexEvidence(),
        observed: indexEvidence(),
      };
    case 'conflict':
      return {
        kind,
        article,
        loaded: { baseMainSha: 'c'.repeat(40) },
        current: { baseMainSha: 'g'.repeat(40) },
      };
    case 'failed':
      return { kind, article, phase: 'save', failure: { category: 'github' } };
    case 'unknown':
      return { kind, article };
  }
}

function indexEvidence() {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: 'excerpt',
    publishedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: 'history',
    categorySlug: 'history',
    tags: [],
    author: 'author',
    cover: { src: 'cover.jpg', alt: 'cover' },
    readingTimeMinutes: 3,
  };
}

describe('buildStudioWorkspaceProjection', () => {
  it('carries both lifecycle axes for the representative saved-and-ready draft', () => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor('draft_valid'), concurrency);

    expect(projection.slug).toBe('tristan-da-cunha');
    expect(projection.workingChange.label).toBe('Ready to publish');
    expect(projection.publishedVersion.label).toBe('Not published');
    expect(projection.actions.publish).toEqual({ available: true });
    expect(projection.actions.save).toEqual({ available: true });
    expect(projection.actions.unpublish.available).toBe(false);
    expect(projection.concurrency).toEqual(concurrency);
    expect(projection.evidence.some((row) => row.label === 'Studio branch')).toBe(true);
  });

  it('keeps the Published version axis separate from an in-progress Working change', () => {
    const lifecycle = lifecycleFor('draft_valid');
    const withProductionLive: StudioLifecycle = {
      ...lifecycle,
      productionLive: {
        mainSha: 'h'.repeat(40),
        contentVersion: 'i'.repeat(64),
        expected: indexEvidence(),
        observed: indexEvidence(),
      },
    } as StudioLifecycle;

    const projection = buildStudioWorkspaceProjection(withProductionLive, concurrency);

    expect(projection.publishedVersion.label).toBe('Live and verified');
    expect(projection.workingChange.label).toBe('Ready to publish');
  });

  it.each(STUDIO_STATUS_KINDS)('produces a valid, decodable projection for kind=%s', (kind) => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor(kind), concurrency);

    expect(STUDIO_PUBLISHED_VERSION_LABELS).toContain(projection.publishedVersion.label);
    expect(STUDIO_WORKING_CHANGE_LABELS).toContain(projection.workingChange.label);
    expect(projection.summary.length).toBeGreaterThan(0);
    expect(projection.recommendedAction.length).toBeGreaterThan(0);
    expect(projection.readerEffect.length).toBeGreaterThan(0);

    const decoded = decodeStudioWorkspaceProjection(projection);
    expect(decoded.ok).toBe(true);
  });

  it('never widens Publish availability for a draft with unresolved issues', () => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor('draft_invalid'), concurrency);
    expect(projection.actions.publish.available).toBe(false);
  });

  // #72: "always-visible count/severity/phase" validation summary, never
  // hidden behind Evidence disclosure.
  it('carries an always-visible validation summary naming the issue count and source', () => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor('draft_invalid'), concurrency);
    expect(projection.validationSummary).toContain('1 validation issue');
    expect(projection.validationSummary).toContain('metadata.title');
  });

  it('reports no validation issues for a kind with none to report', () => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor('draft_valid'), concurrency);
    expect(projection.validationSummary).toBe('No validation issues.');
  });

  it('never widens Publish availability while checks are pending or failing', () => {
    for (const kind of ['ready', 'checking', 'check_failed'] as const) {
      const projection = buildStudioWorkspaceProjection(lifecycleFor(kind), concurrency);
      expect(projection.actions.publish.available).toBe(false);
    }
  });

  // #72 (conservation) as sharpened by #116: an ordinary load remains
  // conservative and never probes, and the conservative state is now the
  // honest neutral "not verified" — no longer the transitional label a
  // fresh merge earns. `ready`/`checking`/`check_failed` never carry probe
  // evidence, even for an already-published canonical article being edited.
  it('labels an unverified published article as not verified on this screen, with no transition phrasing', () => {
    const projection = buildStudioWorkspaceProjection(lifecycleFor('unverified'), concurrency);
    expect(projection.publishedVersion.label).toBe('Published — not verified');
    expect(projection.workingChange.label).toBe('No changes in progress');
    for (const text of [
      projection.summary,
      projection.recommendedAction,
      projection.readerEffect,
    ]) {
      expect(text.toLowerCase()).not.toContain('updating');
      expect(text.toLowerCase()).not.toContain('in progress');
      expect(text.toLowerCase()).not.toContain('soon');
    }
    expect(projection.recommendedAction).toContain('Check status');
    // Unpublish is gated on a verified-live label, which an unprobed
    // projection can never carry.
    expect(projection.actions.unpublish.available).toBe(false);
  });

  it('labels an unverified archived article as archived but unverified', () => {
    const lifecycle: StudioLifecycle = {
      ...lifecycleFor('unverified'),
      article: { ...article, status: 'archived' },
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, concurrency);
    expect(projection.publishedVersion.label).toBe('Archived — not verified');
    expect(projection.actions.unpublish.available).toBe(false);
  });

  it('keeps transitional copy only for genuinely known-recent transitions (story 28)', () => {
    const merged = buildStudioWorkspaceProjection(lifecycleFor('merged'), concurrency);
    expect(merged.publishedVersion.label).toBe('Updating the site');
    const probedPending = buildStudioWorkspaceProjection(
      lifecycleFor('pending_deployment'),
      concurrency,
    );
    expect(probedPending.publishedVersion.label).toBe('Updating the site');
    const removalInFlight = buildStudioWorkspaceProjection(
      lifecycleFor('unpublish_pending'),
      concurrency,
    );
    expect(removalInFlight.publishedVersion.label).toBe('Removing from the site');
  });

  it('carries when a live outcome was verified so the UI can show "Live — verified <time>"', () => {
    const lifecycle: StudioLifecycle = {
      ...lifecycleFor('live'),
      verifiedAt: '2026-08-22T14:02:00.000Z',
    } as StudioLifecycle;
    const projection = buildStudioWorkspaceProjection(lifecycle, concurrency);
    expect(projection.publishedVersion.label).toBe('Live and verified');
    expect(projection.publishedVersion.verifiedAt).toBe('2026-08-22T14:02:00.000Z');
    expect(formatStudioVerifiedAt('2026-08-22T14:02:00.000Z')).toBe('2026-08-22 14:02 UTC');
  });

  it('carries the verification time of productionLive proven alongside an edit draft', () => {
    const withProductionLive: StudioLifecycle = {
      ...lifecycleFor('draft_valid'),
      productionLive: {
        mainSha: 'h'.repeat(40),
        contentVersion: 'i'.repeat(64),
        verifiedAt: '2026-08-22T09:30:00.000Z',
        expected: indexEvidence(),
        observed: indexEvidence(),
      },
    } as StudioLifecycle;
    const projection = buildStudioWorkspaceProjection(withProductionLive, concurrency);
    expect(projection.publishedVersion.label).toBe('Live and verified');
    expect(projection.publishedVersion.verifiedAt).toBe('2026-08-22T09:30:00.000Z');
  });

  it('formats an absent or malformed verification time as empty, never invented', () => {
    expect(formatStudioVerifiedAt(undefined)).toBe('');
    expect(formatStudioVerifiedAt('garbage')).toBe('');
  });

  it('never claims Live and verified for a canonical published article without proven probe evidence', () => {
    for (const kind of ['ready', 'checking', 'check_failed'] as const) {
      const projection = buildStudioWorkspaceProjection(lifecycleFor(kind), concurrency);
      // #116: without evidence the honest state is "not verified", not a
      // perpetual rollout.
      expect(projection.publishedVersion.label).toBe('Published — not verified');
    }
  });

  it('never claims Removed and verified for a canonical archived article without proven probe evidence', () => {
    const lifecycle: StudioLifecycle = {
      ...lifecycleFor('ready'),
      article: { ...article, status: 'archived' },
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, concurrency);
    expect(projection.publishedVersion.label).toBe('Archived — not verified');
  });

  it('still claims Live and verified when a Refresh has actually proven it, even mid-draft', () => {
    const withProductionLive: StudioLifecycle = {
      ...lifecycleFor('draft_valid'),
      productionLive: {
        mainSha: 'h'.repeat(40),
        contentVersion: 'i'.repeat(64),
        expected: indexEvidence(),
        observed: indexEvidence(),
      },
    } as StudioLifecycle;
    const projection = buildStudioWorkspaceProjection(withProductionLive, concurrency);
    expect(projection.publishedVersion.label).toBe('Live and verified');
  });
});

describe('decodeStudioWorkspaceProjection', () => {
  const valid: StudioWorkspaceProjection = buildStudioWorkspaceProjection(
    lifecycleFor('draft_valid'),
    concurrency,
  );

  it('accepts a well-formed projection', () => {
    const result = decodeStudioWorkspaceProjection(valid);
    expect(result).toEqual({ ok: true, value: valid });
  });

  it('rejects non-object input', () => {
    expect(decodeStudioWorkspaceProjection(null).ok).toBe(false);
    expect(decodeStudioWorkspaceProjection('nope').ok).toBe(false);
  });

  it('rejects an unknown top-level key without echoing its value', () => {
    const result = decodeStudioWorkspaceProjection({ ...valid, extra: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('workspace.unknownKey.extra');
  });

  it('rejects a label outside the closed Wayfinder grammar', () => {
    const result = decodeStudioWorkspaceProjection({
      ...valid,
      workingChange: { label: 'Totally custom status' },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a verification time beside the published-version label and rejects malformed ones', () => {
    const withTime = decodeStudioWorkspaceProjection({
      ...valid,
      publishedVersion: { label: 'Live and verified', verifiedAt: '2026-08-22T14:02:00.000Z' },
    });
    expect(withTime).toEqual({
      ok: true,
      value: {
        ...valid,
        publishedVersion: {
          label: 'Live and verified',
          verifiedAt: '2026-08-22T14:02:00.000Z',
        },
      },
    });
    expect(
      decodeStudioWorkspaceProjection({
        ...valid,
        publishedVersion: { label: 'Live and verified', verifiedAt: 'yesterday' },
      }).ok,
    ).toBe(false);
    expect(
      decodeStudioWorkspaceProjection({
        ...valid,
        publishedVersion: { label: 'Not published', extra: 'x' },
      }).ok,
    ).toBe(false);
  });

  it('rejects a malformed concurrency SHA', () => {
    const result = decodeStudioWorkspaceProjection({
      ...valid,
      concurrency: { baseMainSha: 'not-a-sha' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an evidence row with an unknown key', () => {
    const result = decodeStudioWorkspaceProjection({
      ...valid,
      evidence: [{ label: 'x', value: 'y', bogus: 'z' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects more evidence rows than the bound allows', () => {
    const evidence = Array.from({ length: 51 }, (_, index) => ({
      label: `row-${index}`,
      value: 'x',
    }));
    const result = decodeStudioWorkspaceProjection({ ...valid, evidence });
    expect(result.ok).toBe(false);
  });
});
