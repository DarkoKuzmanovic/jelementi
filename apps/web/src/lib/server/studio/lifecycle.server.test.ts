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

  it('fails closed when GitHub contains a Studio branch for a non-canonical article', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    adapter.seedBranch('studio/article/not-on-main', 'c'.repeat(40));

    const result = await deriveStudioArticleList(adapter, {
      productionOrigin: 'https://jelementi.quz.ma',
    });

    expect(result).toEqual({
      ok: false,
      failure: { phase: 'branches', reason: 'topology' },
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
});
