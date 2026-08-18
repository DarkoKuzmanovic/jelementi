import { describe, expect, it } from 'vitest';
import {
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

  // #72: "An ordinary load remains conservative and does not probe: a
  // canonical published article without current probe evidence is
  // Updating the site." `ready`/`checking`/`check_failed` never carry probe
  // evidence, even for an already-published canonical article being edited.
  it('never claims Live and verified for a canonical published article without proven probe evidence', () => {
    for (const kind of ['ready', 'checking', 'check_failed'] as const) {
      const projection = buildStudioWorkspaceProjection(lifecycleFor(kind), concurrency);
      expect(projection.publishedVersion.label).toBe('Updating the site');
    }
  });

  it('never claims Removed and verified for a canonical archived article without proven probe evidence', () => {
    const lifecycle: StudioLifecycle = {
      ...lifecycleFor('ready'),
      article: { ...article, status: 'archived' },
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, concurrency);
    expect(projection.publishedVersion.label).toBe('Removing from the site');
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
