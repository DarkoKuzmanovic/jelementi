import { describe, expect, it, vi } from 'vitest';
import {
  compileArticle,
  serializeArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import { articleContentFingerprint, categorySlug } from '@jelementi/article-model';
import { FakeGithubAdapter } from './github-adapter.fake';
import { deriveStudioArticleList, deriveStudioArticleStatus } from './lifecycle.server';
import type { StudioGithubConfig } from './config.server';
import type { ProbeIndexResult, ProbeResult } from './probe.server';
import type { StudioIndexEvidence } from '../../studio/contracts';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const frontmatter: ArticleSourceFrontmatter = {
  title: 'The 250 People at the End of the World',
  slug: 'tristan-da-cunha',
  excerpt: "The story of the world's most remote permanent settlement.",
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  status: 'published',
  category: 'History',
  tags: ['remote places', 'islands'],
  author: 'Jelementi',
  cover: { src: 'articles/tristan-da-cunha/cover-v1.svg', alt: 'Island' },
  references: [],
};

const articleSource = serializeArticleSource({
  frontmatter,
  body: 'The sea is the only road home.',
});

function seedPublishedArticle(adapter: FakeGithubAdapter): void {
  adapter.seedFile('main', 'content/articles/tristan-da-cunha.md', articleSource, 'b'.repeat(64));
}

describe('deriveStudioArticleList', () => {
  it('lists a canonical published article with no active change', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          slug: 'tristan-da-cunha',
          title: frontmatter.title,
          canonicalStatus: 'published',
          production: 'pending_deployment',
          change: 'none',
          publicUrl: 'https://jelementi.quz.ma/articles/tristan-da-cunha',
        }),
      ],
    });
  });

  it('shows a canonical article with an active branch but no pull request as a draft change', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    expect(branch.ok).toBe(true);

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        slug: 'tristan-da-cunha',
        production: 'pending_deployment',
        change: 'draft',
        branch: { name: 'studio/article/tristan-da-cunha' },
      });
      expect(result.value[0]?.pullRequest).toBeUndefined();
    }
  });

  it('reconstructs a merged pull request after its Studio branch is gone', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
      ok: true,
      value: [
        {
          number: 17,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/17',
          headRef: 'studio/article/tristan-da-cunha',
          headSha: 'c'.repeat(40),
          baseRef: 'main',
          draft: false,
          state: 'merged',
          mergeCommitSha: 'a'.repeat(40),
        },
      ],
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        production: 'pending_deployment',
        change: 'merged',
        pullRequest: { number: 17 },
      });
    }
  });

  it('treats a recreated Studio branch as a new draft after merged history', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
      ok: true,
      value: [
        {
          number: 17,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/17',
          headRef: 'studio/article/tristan-da-cunha',
          headSha: 'c'.repeat(40),
          baseRef: 'main',
          draft: false,
          state: 'merged',
          mergeCommitSha: main.value.sha,
        },
      ],
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        change: 'draft',
        branch: { name: 'studio/article/tristan-da-cunha' },
      });
      expect(result.value[0]?.pullRequest).toBeUndefined();
    }
  });

  it('shows a ready pull request and its successful verify check', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Update article',
      body: 'Studio draft',
      head: 'studio/article/tristan-da-cunha',
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');
    await adapter.updatePullRequest(created.value.number, { draft: false });
    adapter.seedCheckRun(created.value.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1',
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        change: 'ready',
        pullRequest: { number: created.value.number },
        check: { name: 'verify', conclusion: 'success' },
      });
    }
  });

  it('keeps a failed verify check visible and never treats it as ready', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Update article',
      body: 'Studio draft',
      head: 'studio/article/tristan-da-cunha',
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');
    await adapter.updatePullRequest(created.value.number, { draft: false });
    adapter.seedCheckRun(created.value.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/2',
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        change: 'check_failed',
        check: { name: 'verify', conclusion: 'failure' },
      });
    }
  });

  it('lists a new-article draft branch with no committed file as a slug-titled draft row', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    adapter.seedBranch('studio/article/not-on-main', 'c'.repeat(40));

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((row) => row.slug)).toEqual(['not-on-main', 'tristan-da-cunha']);
      const draftRow = result.value[0];
      expect(draftRow).toMatchObject({
        slug: 'not-on-main',
        title: 'not-on-main',
        production: 'absent',
        change: 'draft',
        branch: { name: 'studio/article/not-on-main' },
      });
      expect(draftRow?.canonicalStatus).toBeUndefined();
      expect(draftRow?.updatedAt).toBeUndefined();
      expect(draftRow?.publicUrl).toBeUndefined();
    }
  });

  it('lists a new-article draft using its draft frontmatter when the branch has a committed file', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const draftSource = serializeArticleSource({
      frontmatter: {
        ...frontmatter,
        title: 'A Brand New Article',
        slug: 'new-arrival',
        status: 'draft',
        publishedAt: '2026-08-16',
        updatedAt: '2026-08-16',
      },
      body: 'Fresh words.',
    });
    adapter.seedBranch('studio/article/new-arrival', 'd'.repeat(40));
    adapter.seedFile(
      'studio/article/new-arrival',
      'content/articles/new-arrival.md',
      draftSource,
      'e'.repeat(64),
    );
    adapter.seedPullRequest('studio/article/new-arrival');

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const draftRow = result.value.find((row) => row.slug === 'new-arrival');
      expect(draftRow).toMatchObject({
        title: 'A Brand New Article',
        updatedAt: '2026-08-16',
        production: 'absent',
        change: 'draft',
        branch: { name: 'studio/article/new-arrival' },
      });
      expect(draftRow?.pullRequest?.number).toBeTypeOf('number');
      expect(draftRow?.canonicalStatus).toBeUndefined();
      expect(draftRow?.publicUrl).toBeUndefined();
    }
  });

  it('falls back to a slug-titled row when a new-article draft file does not parse', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    adapter.seedBranch('studio/article/broken-draft', 'f'.repeat(40));
    adapter.seedFile(
      'studio/article/broken-draft',
      'content/articles/broken-draft.md',
      'not an article at all',
      'a1'.repeat(32),
    );

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const draftRow = result.value.find((row) => row.slug === 'broken-draft');
      expect(draftRow).toMatchObject({
        title: 'broken-draft',
        production: 'absent',
        change: 'draft',
      });
      expect(draftRow?.updatedAt).toBeUndefined();
    }
  });

  it('fails closed when a listed branch name is not a valid studio article branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    vi.spyOn(adapter, 'listStudioBranches').mockResolvedValue({
      ok: true,
      value: [
        {
          name: 'studio/article/Bad_Slug',
          sha: 'c'.repeat(40),
          url: 'https://github.com/DarkoKuzmanovic/jelementi/branch/studio/article/Bad_Slug',
        },
      ],
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: false,
      failure: { phase: 'branches', reason: 'topology' },
    });
  });

  it('fails closed when reading a new-article draft file fails on GitHub', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    adapter.seedBranch('studio/article/not-on-main', 'c'.repeat(40));
    adapter.setFailureOperation('get-file-content');

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: false,
      failure: { phase: 'branches', reason: 'github' },
    });
  });

  it('fails closed when an open pull request head differs from the observed branch head', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Update article',
      body: 'Studio draft',
      head: 'studio/article/tristan-da-cunha',
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');
    adapter.seedBranch('studio/article/tristan-da-cunha', 'c'.repeat(40));

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: false,
      failure: { phase: 'pull-request', reason: 'topology' },
    });
  });

  it('fails closed when more than one open pull request is observed for a branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Update article',
      body: 'Studio draft',
      head: 'studio/article/tristan-da-cunha',
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');
    vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
      ok: true,
      value: [created.value, { ...created.value, number: created.value.number + 1 }],
    });

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: false,
      failure: { phase: 'pull-request', reason: 'topology' },
    });
  });
});

const productionOrigin = 'https://jelementi.quz.ma';
const mediaBaseUrl = 'https://media.jelementi.quz.ma/';

function okArticleProbe(fingerprint: string): ProbeResult {
  return {
    ok: true,
    url: 'https://jelementi.quz.ma/articles/tristan-da-cunha?probe=1',
    status: 200,
    fingerprint,
    headers: {},
    elapsedMs: 5,
    attempts: 1,
  };
}

function failArticleProbe(reason: ProbeResult['reason']): ProbeResult {
  return {
    ok: false,
    url: 'https://jelementi.quz.ma/articles/tristan-da-cunha?probe=1',
    status: 0,
    fingerprint: null,
    headers: {},
    elapsedMs: 5,
    attempts: 3,
    reason,
  };
}

function okIndexProbe(entries: StudioIndexEvidence[]): ProbeIndexResult {
  return {
    ok: true,
    url: 'https://jelementi.quz.ma/index.json?probe=1',
    status: 200,
    entries,
    elapsedMs: 5,
    attempts: 1,
  };
}

function failIndexProbe(reason: ProbeIndexResult['reason']): ProbeIndexResult {
  return {
    ok: false,
    url: 'https://jelementi.quz.ma/index.json?probe=1',
    status: 0,
    entries: [],
    elapsedMs: 5,
    attempts: 3,
    reason,
  };
}

function notFoundArticleProbe(): ProbeResult {
  return {
    ok: false,
    url: 'https://jelementi.quz.ma/articles/tristan-da-cunha?probe=1',
    status: 404,
    fingerprint: null,
    headers: {},
    elapsedMs: 5,
    attempts: 3,
    reason: 'non-2xx',
  };
}

const presentIndexEntry: StudioIndexEvidence = {
  slug: 'tristan-da-cunha',
  title: frontmatter.title,
  excerpt: frontmatter.excerpt,
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: frontmatter.category,
  categorySlug: categorySlug(frontmatter.category),
  tags: frontmatter.tags,
  author: frontmatter.author,
  cover: { src: 'articles/tristan-da-cunha/cover-v1.svg', alt: 'Island' },
  readingTimeMinutes: 7,
};

function seedArchivedArticle(adapter: FakeGithubAdapter): void {
  adapter.seedFile(
    'main',
    'content/articles/tristan-da-cunha.md',
    serializeArticleSource({
      frontmatter: { ...frontmatter, status: 'archived' },
      body: 'The sea is the only road home.',
    }),
    'd'.repeat(64),
  );
}

function expectedIndexEvidenceFor(document: {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt?: string;
  updatedAt: string;
  category: string;
  tags: string[];
  author: string;
  cover: { src: string; alt: string };
  readingTimeMinutes: number;
}): StudioIndexEvidence {
  if (document.publishedAt === undefined) throw new Error('publishedAt required');
  return {
    slug: document.slug,
    title: document.title,
    excerpt: document.excerpt,
    publishedAt: document.publishedAt,
    updatedAt: document.updatedAt,
    category: document.category,
    categorySlug: categorySlug(document.category),
    tags: document.tags,
    author: document.author,
    cover: document.cover,
    readingTimeMinutes: document.readingTimeMinutes,
  };
}

function seedMergedHistory(adapter: FakeGithubAdapter, mainSha: string): void {
  vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
    ok: true,
    value: [
      {
        number: 17,
        url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/17',
        headRef: 'studio/article/tristan-da-cunha',
        headSha: 'c'.repeat(40),
        baseRef: 'main',
        draft: false,
        state: 'merged',
        mergeCommitSha: mainSha,
      },
    ],
  });
}

describe('deriveStudioArticleStatus', () => {
  it('keeps a merged unpublish intermediate on ordinary load: canonical archived, never archived without probes', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ kind: 'merged', mainSha: main.value.sha }),
    });
  });

  it('resolves a merged unpublish to archived on refresh only when both probes prove absence', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => notFoundArticleProbe(),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'archived',
        article: expect.objectContaining({ slug: 'tristan-da-cunha', status: 'archived' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('stays unpublish_pending on refresh when a merged unpublish has only partial absence signals', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => notFoundArticleProbe(),
      probeIndex: async () => okIndexProbe([presentIndexEntry]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('stays unpublish_pending on refresh when a merged unpublish probe fails outright', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => failArticleProbe('timeout'),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('reports merged without probing when includeProbe is false, never live', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ kind: 'merged', mainSha: main.value.sha }),
    });
  });

  it('keeps a merged article pending_deployment when the fingerprint does not match, never live', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe('0'.repeat(64)),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ kind: 'pending_deployment', mainSha: main.value.sha }),
    });
  });

  it('resolves Live only when both the fingerprint and the index metadata match', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const document = compileArticle({
      markdown: articleSource,
      sourcePath: 'content/articles/tristan-da-cunha.md',
      mediaBaseUrl,
    }).document;
    const fingerprint = await articleContentFingerprint(document);
    const expectedIndex = expectedIndexEvidenceFor(document);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe(fingerprint),
      probeIndex: async () => okIndexProbe([expectedIndex]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'live',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
        contentVersion: fingerprint,
        expected: expectedIndex,
        observed: expectedIndex,
      },
    });
  });

  it('never claims Live when the article probe times out', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => failArticleProbe('timeout'),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        kind: 'failed',
        phase: 'probe',
        failure: { category: 'timeout' },
      }),
    });
  });

  it('never claims Live when the index probe is unreachable', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    seedMergedHistory(adapter, main.value.sha);

    const document = compileArticle({
      markdown: articleSource,
      sourcePath: 'content/articles/tristan-da-cunha.md',
      mediaBaseUrl,
    }).document;
    const fingerprint = await articleContentFingerprint(document);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe(fingerprint),
      probeIndex: async () => failIndexProbe('network'),
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        kind: 'failed',
        phase: 'probe',
        failure: { category: 'probe' },
      }),
    });
  });

  it('keeps a failed verify check visible and unmerged', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Update article',
      body: 'Studio draft',
      head: 'studio/article/tristan-da-cunha',
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');
    await adapter.updatePullRequest(created.value.number, { draft: false });
    adapter.seedCheckRun(created.value.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/9',
    });

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        kind: 'check_failed',
        pullRequest: expect.objectContaining({ number: created.value.number }),
        failedCheck: {
          name: 'verify',
          url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/9',
        },
      }),
    });
  });

  it('revalidates the committed draft to distinguish draft_valid from draft_invalid', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    if (!branch.ok) throw new Error('branch missing');

    const validSource = serializeArticleSource({
      frontmatter,
      body: 'A different, still valid paragraph.',
    });
    const validCommit = await adapter.commitFile({
      branch: 'studio/article/tristan-da-cunha',
      path: 'content/articles/tristan-da-cunha.md',
      content: validSource,
      message: 'Update draft',
      expectedHeadSha: branch.value.sha,
    });
    if (!validCommit.ok) throw new Error('commit failed');

    const validResult = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    expect(validResult).toEqual({
      ok: true,
      value: expect.objectContaining({ kind: 'draft_valid' }),
    });

    const invalidSource = serializeArticleSource({
      frontmatter,
      body: '# A heading is not supported here',
    });
    const invalidCommit = await adapter.commitFile({
      branch: 'studio/article/tristan-da-cunha',
      path: 'content/articles/tristan-da-cunha.md',
      content: invalidSource,
      message: 'Update draft again',
      expectedHeadSha: validCommit.value.commitSha,
    });
    if (!invalidCommit.ok) throw new Error('commit failed');

    const invalidResult = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    expect(invalidResult.ok).toBe(true);
    if (invalidResult.ok && invalidResult.value.kind === 'draft_invalid') {
      expect(invalidResult.value.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected draft_invalid');
    }
  });

  it('attaches proven Live evidence to draft_valid: Live persists while an edit draft exists', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    if (!branch.ok) throw new Error('branch missing');
    const draftSource = serializeArticleSource({
      frontmatter,
      body: 'A still-valid draft paragraph, unrelated to the published version.',
    });
    const commit = await adapter.commitFile({
      branch: 'studio/article/tristan-da-cunha',
      path: 'content/articles/tristan-da-cunha.md',
      content: draftSource,
      message: 'Update draft',
      expectedHeadSha: branch.value.sha,
    });
    if (!commit.ok) throw new Error('commit failed');

    const document = compileArticle({
      markdown: articleSource,
      sourcePath: 'content/articles/tristan-da-cunha.md',
      mediaBaseUrl,
    }).document;
    const fingerprint = await articleContentFingerprint(document);
    const expectedIndex = expectedIndexEvidenceFor(document);

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe(fingerprint),
      probeIndex: async () => okIndexProbe([expectedIndex]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'draft_valid') {
      throw new Error('expected draft_valid');
    }
    expect(result.value.productionLive).toEqual({
      mainSha: main.value.sha,
      contentVersion: fingerprint,
      expected: expectedIndex,
      observed: expectedIndex,
    });
  });

  it('omits productionLive on draft_valid when Live is not actually proven (ordinary load, or a failed/mismatched probe)', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch('studio/article/tristan-da-cunha', main.value.sha);
    if (!branch.ok) throw new Error('branch missing');
    const draftSource = serializeArticleSource({
      frontmatter,
      body: 'A still-valid draft paragraph.',
    });
    const commit = await adapter.commitFile({
      branch: 'studio/article/tristan-da-cunha',
      path: 'content/articles/tristan-da-cunha.md',
      content: draftSource,
      message: 'Update draft',
      expectedHeadSha: branch.value.sha,
    });
    if (!commit.ok) throw new Error('commit failed');

    // Ordinary load: no probe ever runs, so no Live claim is possible.
    const ordinaryLoad = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    expect(ordinaryLoad.ok && ordinaryLoad.value.kind === 'draft_valid').toBe(true);
    if (ordinaryLoad.ok && ordinaryLoad.value.kind === 'draft_valid') {
      expect(ordinaryLoad.value.productionLive).toBeUndefined();
    }

    // Refresh, but the fingerprint does not match: never a false Live claim.
    const mismatchedRefresh = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe('0'.repeat(64)),
      probeIndex: async () => okIndexProbe([]),
    });
    expect(mismatchedRefresh.ok && mismatchedRefresh.value.kind === 'draft_valid').toBe(true);
    if (mismatchedRefresh.ok && mismatchedRefresh.value.kind === 'draft_valid') {
      expect(mismatchedRefresh.value.productionLive).toBeUndefined();
    }
  });

  it('reports an archived canonical article as unpublish_pending without probing (ordinary load)', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha', status: 'archived' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('reports archived only when refresh proves index absence AND the article route 404s', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => notFoundArticleProbe(),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'archived',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('stays unpublish_pending when only the index lacks the slug but the route still serves content', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => okArticleProbe('0'.repeat(64)),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('stays unpublish_pending when the index still lists the slug despite the route 404', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => notFoundArticleProbe(),
      probeIndex: async () => okIndexProbe([presentIndexEntry]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('stays unpublish_pending when a probe times out, never archived', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedArchivedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => failArticleProbe('timeout'),
      probeIndex: async () => okIndexProbe([]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'unpublish_pending',
        article: expect.objectContaining({ slug: 'tristan-da-cunha' }),
        mainSha: main.value.sha,
      },
    });
  });

  it('reconstructs identical status across repeated reads, with no hidden server-side state', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);

    const first = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    const second = await deriveStudioArticleStatus(adapter, 'tristan-da-cunha', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });

    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: true,
      value: expect.objectContaining({ kind: 'pending_deployment' }),
    });
  });

  it('uses a placeholder article ref for a brand-new article that has not merged yet', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch('studio/article/new-article', main.value.sha);
    if (!branch.ok) throw new Error('branch missing');
    const newSource = serializeArticleSource({
      frontmatter: {
        title: 'New Article',
        slug: 'new-article',
        excerpt: 'A brand-new article not yet merged.',
        updatedAt: '2026-01-01',
        status: 'draft',
        category: 'History',
        tags: [],
        author: 'Jelementi',
        cover: { src: 'articles/new-article/cover-v1.svg', alt: 'Cover' },
        references: [],
      },
      body: 'A brand-new paragraph.',
    });
    const committed = await adapter.commitFile({
      branch: 'studio/article/new-article',
      path: 'content/articles/new-article.md',
      content: newSource,
      message: 'Start draft',
      expectedHeadSha: branch.value.sha,
    });
    if (!committed.ok) throw new Error('commit failed');
    await adapter.createPullRequest({
      title: 'New article',
      body: 'Studio draft',
      head: 'studio/article/new-article',
      base: 'main',
      draft: true,
    });

    const result = await deriveStudioArticleStatus(adapter, 'new-article', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
      now: () => '2026-02-02T00:00:00.000Z',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'draft_valid',
        article: {
          slug: 'new-article',
          title: 'Untitled article',
          status: 'draft',
          updatedAt: '2026-02-02T00:00:00.000Z',
        },
        branch: expect.objectContaining({ name: 'studio/article/new-article' }),
      },
    });
  });

  it('reports an interrupted save (branch with no committed file, #16) as draft_invalid, not a failure', async () => {
    // The recoverable in-between state an interrupted Save leaves behind:
    // branch created, first file commit never landed. The editor resumes it
    // as a blank slug-locked editor and the list shows a slug-titled row;
    // the status projection must render too instead of 503ing the page.
    const adapter = new FakeGithubAdapter(config);
    adapter.seedBranch('studio/article/interrupted-save', 'f'.repeat(40));

    const result = await deriveStudioArticleStatus(adapter, 'interrupted-save', {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
      now: () => '2026-02-02T00:00:00.000Z',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'draft_invalid',
        article: expect.objectContaining({ slug: 'interrupted-save' }),
        branch: expect.objectContaining({ name: 'studio/article/interrupted-save' }),
        issues: [
          expect.objectContaining({
            code: 'MISSING_DRAFT_FILE',
            sourcePath: 'content/articles/interrupted-save.md',
          }),
        ],
      },
    });
  });
});
