import { describe, expect, it, vi } from 'vitest';
import { serializeArticleSource, type ArticleSourceFrontmatter } from '@jelementi/content-compiler';
import { FakeGithubAdapter } from './github-adapter.fake';
import { deriveStudioArticleList } from './lifecycle.server';
import type { StudioGithubConfig } from './config.server';

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
