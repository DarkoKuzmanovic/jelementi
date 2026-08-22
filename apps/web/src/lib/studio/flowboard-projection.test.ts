import { describe, expect, it } from 'vitest';
import type { StudioArticleListEntry, StudioLifecycle } from './contracts';
import { buildStudioFlowboard } from './flowboard-projection';

const mainSha = 'a'.repeat(40);

function row(
  slug: string,
  overrides: Partial<StudioArticleListEntry> = {},
): StudioArticleListEntry {
  return {
    slug,
    title: slug.replaceAll('-', ' '),
    canonicalStatus: 'published',
    updatedAt: '2026-08-17',
    // #116: frontmatter alone can never claim a public fact, so the
    // unprobed list default is the honest neutral state.
    production: 'unverified',
    change: 'none',
    mainSha,
    publicUrl: `https://jelementi.quz.ma/articles/${slug}`,
    ...overrides,
  };
}

describe('buildStudioFlowboard', () => {
  // #116: the board's production axis comes from frontmatter alone, so its
  // unprobed default must read as honest neutral — never as a rollout that
  // never ends. Only a known-recent merged change keeps transition copy.
  it('labels steady articles as not verified and reserves transition copy for known-recent merges', () => {
    const flowboard = buildStudioFlowboard([
      row('steady-published'),
      row('recently-merged', { change: 'merged' }),
      row('archived-steady', { canonicalStatus: 'archived' }),
      row('archived-merging', { canonicalStatus: 'archived', change: 'merged' }),
    ]);

    const byslug = new Map(
      Object.values(flowboard.columns)
        .flat()
        .map((card) => [card.slug, card]),
    );
    expect(byslug.get('steady-published')?.projection.publishedVersion.label).toBe(
      'Published — not verified',
    );
    expect(byslug.get('recently-merged')?.projection.publishedVersion.label).toBe(
      'Updating the site',
    );
    expect(byslug.get('archived-steady')?.projection.publishedVersion.label).toBe(
      'Archived — not verified',
    );
    expect(byslug.get('archived-merging')?.projection.publishedVersion.label).toBe(
      'Removing from the site',
    );

    // A steady article is Library work, not a perpetual rollout.
    expect(flowboard.columns.library.map((card) => card.slug)).toContain('steady-published');
  });

  it('gates unpublish availability on a verified-live label only', () => {
    const flowboard = buildStudioFlowboard([
      row('unverified-live'),
      row('verified-live', { change: 'draft', draftValidity: 'valid' }),
    ]);
    const byslug = new Map(
      Object.values(flowboard.columns)
        .flat()
        .map((card) => [card.slug, card]),
    );
    expect(byslug.get('unverified-live')?.projection.actions.unpublish.available).toBe(false);
    expect(byslug.get('verified-live')?.projection.actions.unpublish.available).toBe(false);
  });

  it('assigns every article exactly once across the three columns', () => {
    const flowboard = buildStudioFlowboard([
      row('invalid-draft', { change: 'draft', draftValidity: 'invalid' }),
      row('checking-change', { change: 'checking' }),
      row('ready-draft', { change: 'draft', draftValidity: 'valid' }),
      row('merged-change', { change: 'merged' }),
      row('library-article'),
    ]);

    expect(flowboard.columns.resumeWork.map((card) => card.slug)).toEqual([
      'checking-change',
      'invalid-draft',
    ]);
    expect(flowboard.columns.readyForDecision.map((card) => card.slug)).toEqual([
      'merged-change',
      'ready-draft',
    ]);
    expect(flowboard.columns.library.map((card) => card.slug)).toEqual(['library-article']);

    const assigned = Object.values(flowboard.columns)
      .flat()
      .map((card) => card.slug);
    expect(assigned).toHaveLength(flowboard.totalCount);
    expect(new Set(assigned).size).toBe(flowboard.totalCount);
  });

  it('keeps an article-local failure visible as Status unavailable in Resume work', () => {
    const flowboard = buildStudioFlowboard([
      row('uncertain-article', {
        change: 'draft',
        draftValidity: 'unavailable',
        failure: { phase: 'check', reason: 'github' },
      }),
    ]);

    const card = flowboard.columns.resumeWork[0];
    expect(card?.projection.workingChange.label).toBe('Status unavailable');
    expect(card?.primaryAction).toEqual({ kind: 'check', label: 'Check status' });
    expect(card?.projection.evidence).toContainEqual({
      label: 'Status observation',
      value: 'check unavailable (github)',
    });
  });

  it('links a valid committed draft to the Editorial desk publication center', () => {
    const flowboard = buildStudioFlowboard([
      row('ready-draft', { change: 'draft', draftValidity: 'valid' }),
    ]);

    expect(flowboard.columns.readyForDecision[0]?.primaryAction).toEqual({
      kind: 'link',
      label: 'Publish saved version',
      href: '/studio/articles/ready-draft#publication-center',
    });
  });

  it('uses the stable Editorial desk validation and recovery anchors owned by #75', () => {
    const invalid = buildStudioFlowboard([
      row('invalid-draft', { change: 'draft', draftValidity: 'invalid' }),
    ]);
    expect(invalid.columns.resumeWork[0]?.primaryAction).toMatchObject({
      href: '/studio/articles/invalid-draft#validation-summary',
    });

    const conflict: StudioLifecycle = {
      kind: 'conflict',
      article: {
        slug: 'moved-draft',
        title: 'Moved draft',
        status: 'published',
        updatedAt: '2026-08-17',
      },
      loaded: { baseMainSha: mainSha },
      current: { baseMainSha: 'b'.repeat(40) },
    };
    const moved = buildStudioFlowboard(
      [row('moved-draft', { change: 'draft', draftValidity: 'valid' })],
      conflict,
    );
    expect(moved.columns.resumeWork[0]?.primaryAction).toMatchObject({
      href: '/studio/articles/moved-draft#recovery',
    });
  });

  it('keeps Live separate while a working change chooses the primary action', () => {
    const checked: StudioLifecycle = {
      kind: 'draft_valid',
      article: {
        slug: 'live-with-draft',
        title: 'Live with draft',
        status: 'published',
        updatedAt: '2026-08-17',
      },
      branch: {
        name: 'studio/article/live-with-draft',
        url: 'https://github.com/example/jelementi/tree/studio/article/live-with-draft',
        headSha: 'b'.repeat(40),
      },
      productionLive: {
        mainSha,
        contentVersion: 'c'.repeat(64),
        expected: {
          slug: 'live-with-draft',
          title: 'Live with draft',
          excerpt: 'Excerpt',
          publishedAt: '2026-08-17',
          updatedAt: '2026-08-17',
          category: 'Studio',
          categorySlug: 'studio',
          tags: [],
          author: 'Jelementi',
          cover: { src: 'cover.svg', alt: 'Cover' },
          readingTimeMinutes: 1,
        },
        observed: {
          slug: 'live-with-draft',
          title: 'Live with draft',
          excerpt: 'Excerpt',
          publishedAt: '2026-08-17',
          updatedAt: '2026-08-17',
          category: 'Studio',
          categorySlug: 'studio',
          tags: [],
          author: 'Jelementi',
          cover: { src: 'cover.svg', alt: 'Cover' },
          readingTimeMinutes: 1,
        },
      },
    };

    const flowboard = buildStudioFlowboard(
      [
        row('live-with-draft', {
          change: 'draft',
          draftValidity: 'valid',
          branch: checked.branch,
        }),
      ],
      checked,
    );

    const card = flowboard.columns.readyForDecision[0];
    expect(card?.projection.publishedVersion.label).toBe('Live and verified');
    expect(card?.projection.workingChange.label).toBe('Ready to publish');
    expect(card?.primaryAction.label).toBe('Publish saved version');
  });
});
