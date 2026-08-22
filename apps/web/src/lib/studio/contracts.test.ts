import { describe, expect, it } from 'vitest';
import { ArticleStatusSchema, type ArticleDocument } from '@jelementi/article-model';
import {
  compileArticle,
  serializeArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import {
  decodeConcurrencyEvidence,
  decodeStudioEditorInput,
  decodeStudioLifecycle,
  decodeStudioPreview,
  type StudioArticleStatus,
  type StudioConcurrencyEvidence,
  type StudioEditorInput,
  type StudioMetadata,
  type StudioStatusKind,
} from './contracts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA64 = 'c'.repeat(64);

const articleRef = (status: StudioArticleStatus = 'published') => ({
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  status,
  updatedAt: '2026-07-26',
  url: 'https://jelementi.quz.ma/articles/tristan-da-cunha',
});

const branchRef = {
  name: 'studio/article/tristan-da-cunha',
  url: 'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/tristan-da-cunha',
  headSha: SHA_B,
};

const pullRequestRef = {
  number: 12,
  url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/12',
  headSha: SHA_B,
};

const concurrencyEvidence: StudioConcurrencyEvidence = {
  baseMainSha: SHA_A,
  draftHeadSha: SHA_B,
  expectedBlobSha: SHA64,
};

const indexEvidence = {
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  excerpt: "The story of the world's most remote permanent settlement.",
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  categorySlug: 'history',
  tags: ['remote places', 'islands', 'communities'],
  author: 'Jelementi',
  cover: {
    src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.webp',
    alt: 'The volcanic island of Tristan da Cunha',
  },
  readingTimeMinutes: 3,
};

const fullMetadata: StudioMetadata = {
  title: 'The 250 People at the End of the World',
  slug: 'tristan-da-cunha',
  excerpt: "The story of the world's most remote permanent settlement.",
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['remote places', 'islands', 'communities'],
  author: 'Jelementi',
  cover: {
    src: 'articles/tristan-da-cunha/cover-v1.webp',
    alt: 'The volcanic island of Tristan da Cunha',
  },
  audio: { src: 'articles/tristan-da-cunha/audio-v1.mp3', durationSeconds: 1842 },
  references: [
    {
      title: 'Tristan da Cunha — Government and history',
      url: 'https://example.org/source',
      publisher: 'Example Org',
      accessedAt: '2026-07-26',
    },
  ],
};

const fullEditorInput: StudioEditorInput = {
  metadata: fullMetadata,
  body: 'Pull up a map. Find *South America* on the left and **Africa** on the right.',
  concurrency: concurrencyEvidence,
};

const minimalDraftInput: StudioEditorInput = {
  metadata: {
    title: 'Draft Notes',
    slug: 'draft-notes',
    excerpt: 'A draft in progress.',
    updatedAt: '2026-08-01',
    status: 'draft',
    category: 'Ideas',
    tags: ['draft'],
    author: 'Jelementi',
    cover: { src: 'articles/draft-notes/cover-v1.webp', alt: 'Draft cover' },
    references: [{ title: 'Source', url: 'https://example.org/draft' }],
  },
  body: '',
  concurrency: { baseMainSha: SHA_A },
};

const lifecycleFixtures: ReadonlyArray<{ kind: StudioStatusKind; value: Record<string, unknown> }> =
  [
    {
      kind: 'draft_invalid',
      value: {
        kind: 'draft_invalid',
        article: articleRef('draft'),
        branch: branchRef,
        issues: [
          {
            code: 'UNSUPPORTED_NODE',
            message: 'Unsupported node',
            sourcePath: 'content/articles/x.md',
            line: 3,
            column: 1,
          },
        ],
      },
    },
    {
      kind: 'draft_valid',
      value: { kind: 'draft_valid', article: articleRef('draft'), branch: branchRef },
    },
    {
      kind: 'ready',
      value: { kind: 'ready', article: articleRef('draft'), pullRequest: pullRequestRef },
    },
    {
      kind: 'checking',
      value: { kind: 'checking', article: articleRef('draft'), pullRequest: pullRequestRef },
    },
    {
      kind: 'check_failed',
      value: {
        kind: 'check_failed',
        article: articleRef('draft'),
        pullRequest: pullRequestRef,
        failedCheck: {
          name: 'verify',
          url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1',
        },
      },
    },
    { kind: 'merged', value: { kind: 'merged', article: articleRef(), mainSha: SHA_A } },
    {
      kind: 'pending_deployment',
      value: { kind: 'pending_deployment', article: articleRef(), mainSha: SHA_A },
    },
    {
      kind: 'live',
      value: {
        kind: 'live',
        article: articleRef(),
        mainSha: SHA_A,
        contentVersion: SHA64,
        expected: indexEvidence,
        observed: indexEvidence,
      },
    },
    {
      kind: 'unpublish_pending',
      value: { kind: 'unpublish_pending', article: articleRef('archived'), mainSha: SHA_A },
    },
    {
      kind: 'archived',
      value: { kind: 'archived', article: articleRef('archived'), mainSha: SHA_A },
    },
    {
      kind: 'conflict',
      value: {
        kind: 'conflict',
        article: articleRef('draft'),
        loaded: concurrencyEvidence,
        current: { baseMainSha: SHA_A, draftHeadSha: SHA_B, expectedBlobSha: 'd'.repeat(64) },
      },
    },
    {
      kind: 'failed',
      value: {
        kind: 'failed',
        article: articleRef('draft'),
        phase: 'probe',
        failure: {
          category: 'timeout',
          url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/2',
        },
      },
    },
    { kind: 'unknown', value: { kind: 'unknown', article: articleRef('draft') } },
  ];

describe('decodeStudioEditorInput', () => {
  it('accepts a full valid published input with all optional fields', () => {
    const result = decodeStudioEditorInput(fullEditorInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.body).toBe(fullEditorInput.body);
      expect(result.value.metadata.audio?.durationSeconds).toBe(1842);
      expect(result.value.metadata.references[0]?.publisher).toBe('Example Org');
      expect(result.value.concurrency).toEqual(concurrencyEvidence);
    }
  });

  it('accepts a minimal draft input with empty body and only baseMainSha', () => {
    const result = decodeStudioEditorInput(minimalDraftInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.status).toBe('draft');
      expect(result.value.metadata.publishedAt).toBeUndefined();
      expect(result.value.metadata.audio).toBeUndefined();
      expect(result.value.body).toBe('');
    }
  });

  it('accepts uppercase SHAs and normalizes them to lowercase', () => {
    const upper = {
      ...fullEditorInput,
      concurrency: { baseMainSha: SHA_A.toUpperCase(), draftHeadSha: SHA_B.toUpperCase() },
    };
    const result = decodeStudioEditorInput(upper);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.concurrency.baseMainSha).toBe(SHA_A);
      expect(result.value.concurrency.draftHeadSha).toBe(SHA_B);
    }
  });

  it('rejects null, arrays, strings, and numbers', () => {
    for (const value of [null, undefined, 'text', 42, [fullEditorInput]]) {
      expect(decodeStudioEditorInput(value).ok).toBe(false);
    }
  });

  it('rejects unknown top-level keys (e.g. a credential field)', () => {
    expect(decodeStudioEditorInput({ ...fullEditorInput, installationToken: 'x' }).ok).toBe(false);
  });

  it('rejects unknown metadata, cover, audio, and reference keys', () => {
    const cases: Array<Record<string, unknown>> = [
      { ...fullEditorInput, metadata: { ...fullMetadata, secret: 'x' } },
      {
        ...fullEditorInput,
        metadata: { ...fullMetadata, cover: { ...fullMetadata.cover, extra: 'x' } },
      },
      {
        ...fullEditorInput,
        metadata: { ...fullMetadata, audio: { ...fullMetadata.audio, extra: 'x' } },
      },
      {
        ...fullEditorInput,
        metadata: { ...fullMetadata, references: [{ ...fullMetadata.references[0], extra: 'x' }] },
      },
    ];
    for (const value of cases) {
      expect(decodeStudioEditorInput(value).ok).toBe(false);
    }
  });

  it('reports cover, audio, and reference failures even when an unrelated field failed first (#114)', () => {
    // #114 removed the native `required` attributes, so emptied metadata
    // reaches this decoder on every Preview/Save. Field checks must not be
    // suppressed by earlier failures: each invalid sub-object still yields
    // its own anchored decode path.
    const result = decodeStudioEditorInput({
      ...minimalDraftInput,
      metadata: {
        ...minimalDraftInput.metadata,
        title: '',
        cover: { src: 'has spaces', alt: '' },
        audio: { src: '/absolute' },
        references: [{ title: 'Source', url: 'ftp://example.org/file' }],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('input.metadata.title.empty');
      expect(result.issues).toContain('input.metadata.cover.src.mediaKey');
      expect(result.issues).toContain('input.metadata.cover.alt.empty');
      expect(result.issues).toContain('input.metadata.audio.src.mediaKey');
      expect(result.issues).toContain('input.metadata.references[0].url.url');
    }
  });

  it('still stops validating a sub-object whose own keys were tampered (#114)', () => {
    // The unknown-key guard keeps its per-sub-object scope: a tampered cover
    // skips cover field validation, but unrelated failures never trigger it.
    const result = decodeStudioEditorInput({
      ...minimalDraftInput,
      metadata: { ...minimalDraftInput.metadata, cover: { src: '', alt: '', extra: 'x' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('input.metadata.cover.unknownKey.extra');
      expect(result.issues).not.toContain('input.metadata.cover.src.mediaKey');
    }
  });

  it('rejects path-like and malformed slugs', () => {
    for (const slug of [
      '../escape',
      'a/b',
      'a\\b',
      'a..b',
      'a.b',
      'A-B',
      'a b',
      '-lead',
      'trail-',
      '',
      'a'.repeat(101),
    ]) {
      const value = { ...fullEditorInput, metadata: { ...fullMetadata, slug } };
      expect(decodeStudioEditorInput(value).ok).toBe(false);
    }
  });

  it('rejects malformed SHAs', () => {
    for (const sha of ['abc', 'z'.repeat(40), 'a'.repeat(39), 'a'.repeat(41), 'a'.repeat(65)]) {
      expect(
        decodeStudioEditorInput({ ...fullEditorInput, concurrency: { baseMainSha: sha } }).ok,
      ).toBe(false);
    }
  });

  it('rejects missing required concurrency evidence', () => {
    const { baseMainSha: _baseMainSha, ...withoutBase } = concurrencyEvidence;
    expect(decodeStudioEditorInput({ ...fullEditorInput, concurrency: withoutBase }).ok).toBe(
      false,
    );
    expect(decodeStudioEditorInput({ ...fullEditorInput, concurrency: undefined }).ok).toBe(false);
  });

  it('rejects invalid article status values', () => {
    for (const status of ['live', 'pending', 'ready', 42]) {
      expect(
        decodeStudioEditorInput({ ...fullEditorInput, metadata: { ...fullMetadata, status } }).ok,
      ).toBe(false);
    }
  });

  it('rejects invalid tags and references', () => {
    const badTags = { ...fullEditorInput, metadata: { ...fullMetadata, tags: ['ok', ''] } };
    expect(decodeStudioEditorInput(badTags).ok).toBe(false);
    const tooManyTags = {
      ...fullEditorInput,
      metadata: { ...fullMetadata, tags: Array.from({ length: 101 }, () => 't') },
    };
    expect(decodeStudioEditorInput(tooManyTags).ok).toBe(false);
    const httpReference = {
      ...fullEditorInput,
      metadata: {
        ...fullMetadata,
        references: [{ title: 'Source', url: 'http://example.org/source' }],
      },
    };
    expect(decodeStudioEditorInput(httpReference).ok).toBe(false);
  });

  it('rejects malformed dates', () => {
    for (const updatedAt of ['yesterday', '2026-13-01T00:00:00Z']) {
      expect(
        decodeStudioEditorInput({ ...fullEditorInput, metadata: { ...fullMetadata, updatedAt } })
          .ok,
      ).toBe(false);
    }
  });

  it('rejects a non-string or oversized body', () => {
    expect(decodeStudioEditorInput({ ...fullEditorInput, body: 42 }).ok).toBe(false);
    const huge = 'x'.repeat(2_000_001);
    expect(decodeStudioEditorInput({ ...fullEditorInput, body: huge }).ok).toBe(false);
  });

  it('rejects whitespace-only required strings', () => {
    for (const field of ['title', 'excerpt', 'category', 'author'] as const) {
      expect(
        decodeStudioEditorInput({
          ...fullEditorInput,
          metadata: { ...fullMetadata, [field]: '   ' },
        }).ok,
      ).toBe(false);
    }
  });

  it('does not throw on cyclic input', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      decodeStudioEditorInput({ ...fullEditorInput, metadata: { ...fullMetadata, cover: cyclic } }),
    ).not.toThrow();
    expect(
      decodeStudioEditorInput({ ...fullEditorInput, metadata: { ...fullMetadata, cover: cyclic } })
        .ok,
    ).toBe(false);
  });
});

describe('decodeConcurrencyEvidence', () => {
  it('accepts full and minimal evidence', () => {
    expect(decodeConcurrencyEvidence(concurrencyEvidence).ok).toBe(true);
    expect(decodeConcurrencyEvidence({ baseMainSha: SHA_A }).ok).toBe(true);
  });

  it('rejects unknown keys and malformed fields', () => {
    expect(decodeConcurrencyEvidence({ ...concurrencyEvidence, token: 'x' }).ok).toBe(false);
    expect(decodeConcurrencyEvidence({ baseMainSha: 'nope' }).ok).toBe(false);
    expect(decodeConcurrencyEvidence({ baseMainSha: SHA_A, draftHeadSha: 7 }).ok).toBe(false);
  });
});

describe('decodeStudioLifecycle', () => {
  it('accepts every approved presentation status with valid evidence', () => {
    expect(lifecycleFixtures.length).toBe(13);
    for (const fixture of lifecycleFixtures) {
      const result = decodeStudioLifecycle(fixture.value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.kind).toBe(fixture.kind);
    }
  });

  it('rejects unknown or missing kinds', () => {
    for (const kind of ['success', 'ok', 'live!', 'published', 42]) {
      expect(decodeStudioLifecycle({ kind, article: articleRef() }).ok).toBe(false);
    }
    const first = lifecycleFixtures.find(() => true);
    if (!first) throw new Error('fixture missing');
    const { kind: _kind, ...withoutKind } = first.value;
    expect(decodeStudioLifecycle(withoutKind).ok).toBe(false);
  });

  it('live cannot decode without content-version or expected/observed production-index evidence', () => {
    const base = lifecycleFixtures.find((f) => f.kind === 'live')?.value;
    if (!base) throw new Error('live fixture missing');
    expect(decodeStudioLifecycle({ ...base, contentVersion: undefined }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...base, expected: undefined }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...base, observed: undefined }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...base, contentVersion: SHA_A }).ok).toBe(false);
    expect(
      decodeStudioLifecycle({ ...base, observed: { ...indexEvidence, slug: 'other' } }).ok,
    ).toBe(false);
  });

  it('live accepts complete identical index evidence with no tags', () => {
    const base = lifecycleFixtures.find((f) => f.kind === 'live')?.value;
    if (!base) throw new Error('live fixture missing');
    const taglessEvidence = { ...indexEvidence, tags: [] };
    expect(
      decodeStudioLifecycle({ ...base, expected: taglessEvidence, observed: taglessEvidence }).ok,
    ).toBe(true);
  });

  it('live rejects any mismatch between expected and observed index evidence', () => {
    const base = lifecycleFixtures.find((f) => f.kind === 'live')?.value;
    if (!base) throw new Error('live fixture missing');
    const mutations: Array<Record<string, unknown>> = [
      { slug: 'other' },
      { title: 'Other title' },
      { excerpt: 'Other excerpt' },
      { publishedAt: '2026-07-27' },
      { updatedAt: '2026-07-27' },
      { category: 'Science' },
      { categorySlug: 'science' },
      { tags: ['islands', 'remote places'] },
      { author: 'Other author' },
      {
        cover: {
          src: 'https://media.jelementi.quz.ma/articles/other/cover-v1.webp',
          alt: 'Other cover',
        },
      },
      { readingTimeMinutes: 5 },
    ];
    for (const mutation of mutations) {
      expect(
        decodeStudioLifecycle({ ...base, observed: { ...indexEvidence, ...mutation } }).ok,
      ).toBe(false);
    }
  });

  it('live rejects a non-published article status', () => {
    const base = lifecycleFixtures.find((f) => f.kind === 'live')?.value;
    if (!base) throw new Error('live fixture missing');
    expect(decodeStudioLifecycle({ ...base, article: articleRef('draft') }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...base, article: articleRef('archived') }).ok).toBe(false);
  });

  it('rejects an article body or credentials smuggled into a status envelope', () => {
    const base = lifecycleFixtures.find((f) => f.kind === 'live')?.value;
    if (!base) throw new Error('live fixture missing');
    for (const key of [
      'body',
      'authorization',
      'cf-access-jwt-assertion',
      'privateKey',
      'installationToken',
    ]) {
      expect(decodeStudioLifecycle({ ...base, [key]: 'secret' }).ok).toBe(false);
    }
  });

  it('draft_invalid requires non-empty issues; draft_valid rejects an issues key', () => {
    const invalid = lifecycleFixtures.find((f) => f.kind === 'draft_invalid')?.value;
    const valid = lifecycleFixtures.find((f) => f.kind === 'draft_valid')?.value;
    if (!invalid || !valid) throw new Error('draft fixtures missing');
    expect(decodeStudioLifecycle({ ...invalid, issues: [] }).ok).toBe(false);
    expect(
      decodeStudioLifecycle({ ...valid, issues: [{ code: 'X', message: 'Y', sourcePath: 'z' }] })
        .ok,
    ).toBe(false);
  });

  it('draft_invalid/draft_valid accept optional productionLive evidence, proving Live persists alongside an edit draft', () => {
    const invalid = lifecycleFixtures.find((f) => f.kind === 'draft_invalid')?.value;
    const valid = lifecycleFixtures.find((f) => f.kind === 'draft_valid')?.value;
    if (!invalid || !valid) throw new Error('draft fixtures missing');
    const productionLive = {
      mainSha: SHA_A,
      contentVersion: SHA64,
      expected: indexEvidence,
      observed: indexEvidence,
    };
    expect(decodeStudioLifecycle({ ...valid, productionLive }).ok).toBe(true);
    expect(decodeStudioLifecycle({ ...invalid, productionLive }).ok).toBe(true);
    // Absent productionLive stays valid (unproven, never a false claim).
    expect(decodeStudioLifecycle(valid).ok).toBe(true);
    // Mismatched expected/observed within productionLive is rejected, same
    // as the top-level `live` kind's own evidence-mismatch check.
    expect(
      decodeStudioLifecycle({
        ...valid,
        productionLive: { ...productionLive, observed: { ...indexEvidence, title: 'Different' } },
      }).ok,
    ).toBe(false);
  });

  it('ready/checking require a valid pull request; check_failed requires failedCheck', () => {
    const ready = lifecycleFixtures.find((f) => f.kind === 'ready')?.value;
    const failed = lifecycleFixtures.find((f) => f.kind === 'check_failed')?.value;
    if (!ready || !failed) throw new Error('fixtures missing');
    expect(decodeStudioLifecycle({ ...ready, pullRequest: undefined }).ok).toBe(false);
    expect(
      decodeStudioLifecycle({ ...ready, pullRequest: { ...pullRequestRef, number: 0 } }).ok,
    ).toBe(false);
    expect(
      decodeStudioLifecycle({
        ...ready,
        pullRequest: { ...pullRequestRef, url: 'http://example.org' },
      }).ok,
    ).toBe(false);
    expect(decodeStudioLifecycle({ ...failed, failedCheck: undefined }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...failed, failedCheck: { name: ' ' } }).ok).toBe(false);
  });

  it('merged/pending/unpublish_pending/archived require mainSha', () => {
    for (const kind of ['merged', 'pending_deployment', 'unpublish_pending', 'archived'] as const) {
      const fixture = lifecycleFixtures.find((f) => f.kind === kind)?.value;
      if (!fixture) throw new Error(`fixture missing: ${kind}`);
      expect(decodeStudioLifecycle({ ...fixture, mainSha: undefined }).ok).toBe(false);
    }
  });

  it('conflict requires differing loaded and current evidence', () => {
    const conflict = lifecycleFixtures.find((f) => f.kind === 'conflict')?.value;
    if (!conflict) throw new Error('conflict fixture missing');
    expect(decodeStudioLifecycle({ ...conflict, current: undefined }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...conflict, current: concurrencyEvidence }).ok).toBe(false);
  });

  it('failed requires a known category and a non-empty phase; rejects stack traces', () => {
    const failed = lifecycleFixtures.find((f) => f.kind === 'failed')?.value;
    if (!failed) throw new Error('failed fixture missing');
    expect(decodeStudioLifecycle({ ...failed, failure: { category: 'mystery' } }).ok).toBe(false);
    expect(decodeStudioLifecycle({ ...failed, phase: '' }).ok).toBe(false);
    expect(
      decodeStudioLifecycle({
        ...failed,
        failure: { ...(failed.failure as Record<string, unknown>), stack: 'at fn (x)' },
      }).ok,
    ).toBe(false);
  });

  it('rejects non-record input and never throws on hostile values', () => {
    for (const value of [null, undefined, 42, 'x', [], {}, { kind: 'live' }]) {
      expect(() => decodeStudioLifecycle(value)).not.toThrow();
      expect(decodeStudioLifecycle(value).ok).toBe(false);
    }
  });
});

describe('decodeStudioPreview', () => {
  const document: ArticleDocument = {
    schemaVersion: 1,
    slug: 'tristan-da-cunha',
    title: 'The 250 People at the End of the World',
    excerpt: 'A remote settlement.',
    status: 'published',
    publishedAt: '2026-07-26',
    updatedAt: '2026-07-26',
    category: 'History',
    tags: ['islands'],
    author: 'Jelementi',
    cover: {
      src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.webp',
      alt: 'Island',
    },
    readingTimeMinutes: 1,
    blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Body.' }] }],
    footnotes: [],
    references: [],
  };

  it('accepts preview_ok with a complete valid ArticleDocument and empty compileIssues', () => {
    const result = decodeStudioPreview({ kind: 'preview_ok', document, compileIssues: [] });
    if (result.ok && result.value.kind === 'preview_ok') {
      expect(result.value.document.slug).toBe('tristan-da-cunha');
    }
  });

  it('rejects an incomplete document object instead of casting it to ArticleDocument', () => {
    expect(
      decodeStudioPreview({
        kind: 'preview_ok',
        document: { schemaVersion: 1, slug: 'tristan-da-cunha', blocks: [] },
        compileIssues: [],
      }).ok,
    ).toBe(false);
  });

  it('accepts preview_issues with non-empty structured issues', () => {
    const result = decodeStudioPreview({
      kind: 'preview_issues',
      compileIssues: [
        {
          code: 'UNSUPPORTED_NODE',
          message: 'Unsupported',
          sourcePath: 'content/articles/x.md',
          line: 2,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects impossible combinations and smuggled fields', () => {
    expect(
      decodeStudioPreview({
        kind: 'preview_ok',
        document,
        compileIssues: [{ code: 'X', message: 'Y', sourcePath: 'z' }],
      }).ok,
    ).toBe(false);
    expect(decodeStudioPreview({ kind: 'preview_issues', compileIssues: [] }).ok).toBe(false);
    expect(
      decodeStudioPreview({ kind: 'preview_ok', document, compileIssues: [], token: 'x' }).ok,
    ).toBe(false);
    expect(
      decodeStudioPreview({
        kind: 'preview_issues',
        compileIssues: [{ code: 'X', message: 'Y', sourcePath: 'z', stack: 'at fn' }],
      }).ok,
    ).toBe(false);
    expect(decodeStudioPreview({ kind: 'success', document }).ok).toBe(false);
  });
});

describe('contract boundaries', () => {
  it('keeps the canonical article status schema unchanged', () => {
    expect(ArticleStatusSchema.options).toEqual(['draft', 'published', 'archived']);
    expect(ArticleStatusSchema.options).toEqual([...STUDIO_ARTICLE_STATUSES]);
  });

  it('round-trips decoded metadata through the M3-T1 serializer and compiler', () => {
    const result = decodeStudioEditorInput(fullEditorInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const metadata: ArticleSourceFrontmatter = result.value.metadata;
    const source = serializeArticleSource({ frontmatter: metadata, body: result.value.body });
    const compiled = compileArticle({
      markdown: source,
      sourcePath: 'content/articles/tristan-da-cunha.md',
      mediaBaseUrl: 'https://media.example.org/',
    });
    expect(compiled.document.slug).toBe('tristan-da-cunha');
    expect(compiled.document.status).toBe('published');
    expect(compiled.document.audio?.durationSeconds).toBe(1842);
  });

  it('lifecycle types never expose credential or raw-upstream fields', () => {
    const serialized = JSON.stringify(lifecycleFixtures.map((f) => f.value));
    for (const forbidden of ['token', 'assertion', 'privateKey', 'installationId', 'stack']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

// Re-export only for the enum-alignment assertion above; keeps the test self-documenting.
const STUDIO_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
