import { describe, expect, it } from 'vitest';
import {
  parseArticleSource,
  serializeArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import { FakeGithubAdapter } from './github-adapter.fake';
import { unpublishStudioArticle } from './unpublish.server';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const unpublishOptions = { mediaBaseUrl: 'https://media.jelementi.quz.ma/' };
const slug = 'a-published-article';
const branchName = `studio/article/${slug}`;
const path = `content/articles/${slug}.md`;

const publishedFrontmatter: ArticleSourceFrontmatter = {
  title: 'A Published Article',
  slug,
  excerpt: 'An article currently published.',
  publishedAt: '2026-08-01',
  updatedAt: '2026-08-01',
  status: 'published',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-published-article/cover.svg', alt: 'A published cover' },
  references: [],
};

const publishedSource = serializeArticleSource({
  frontmatter: publishedFrontmatter,
  body: 'Published body.',
});

function seedPublishedArticle(adapter: FakeGithubAdapter, body = 'Published body.'): void {
  adapter.seedFile(
    'main',
    path,
    serializeArticleSource({ frontmatter: publishedFrontmatter, body }),
    'b'.repeat(64),
  );
}

async function branchFileContent(adapter: FakeGithubAdapter): Promise<string | undefined> {
  const branch = await adapter.getBranch(branchName);
  if (!branch.ok) return undefined;
  const file = await adapter.getFileContent(branch.value.sha, path);
  return file.ok ? file.value.content : undefined;
}

describe('unpublishStudioArticle', () => {
  it('commits an archive change, flips the Draft PR ready, and enables auto-merge for the exact archive head', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result.kind).toBe('unpublish_submitted');
    if (result.kind !== 'unpublish_submitted') return;
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(result.commitSha);

    // The branch head now carries the archive commit; the sole PR was flipped
    // ready and auto-merge was enabled for that exact head.
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({
        number: result.pullRequest.number,
        draft: false,
        state: 'open',
        headSha: result.commitSha,
      }),
    ]);
  });

  it('changes only the frontmatter status to archived, leaving every other field and the body identical', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);
    expect(result.kind).toBe('unpublish_submitted');
    if (result.kind !== 'unpublish_submitted') return;

    const branchContent = await branchFileContent(adapter);
    if (branchContent === undefined) throw new Error('archive commit missing');
    const canonical = parseArticleSource(publishedSource, path);
    const archived = parseArticleSource(branchContent, path);

    expect(archived.frontmatter.status).toBe('archived');
    expect(archived.body).toBe(canonical.body);
    const { status: _archivedStatus, ...archivedWithoutStatus } = archived.frontmatter;
    const { status: _canonicalStatus, ...canonicalWithoutStatus } = canonical.frontmatter;
    expect(archivedWithoutStatus).toEqual(canonicalWithoutStatus);
  });

  it('is idempotent: re-running at the same archive head reuses the branch and PR without duplicates', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);

    const first = await unpublishStudioArticle(adapter, slug, unpublishOptions);
    expect(first.kind).toBe('unpublish_submitted');
    if (first.kind !== 'unpublish_submitted') return;
    const branchAfterFirst = await adapter.getBranch(branchName);
    if (!branchAfterFirst.ok) throw new Error('branch missing');

    const second = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(second.kind).toBe('unpublish_submitted');
    if (second.kind !== 'unpublish_submitted') return;
    const branchAfterSecond = await adapter.getBranch(branchName);
    expect(branchAfterSecond.ok && branchAfterSecond.value.sha).toBe(first.commitSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(1);
    expect(pulls.ok && pulls.value[0]?.number).toBe(first.pullRequest.number);
  });

  it('blocks a byte-different but semantically identical committed draft as differing-draft, with zero writes', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch(branchName, main.value.sha);
    if (!branch.ok) throw new Error('branch missing');
    // Same frontmatter values and body as canonical main, but the YAML block
    // is byte-different (frontmatter key order swapped): parsing yields the
    // same semantic source, so only exact content identity can catch it.
    const lines = publishedSource.split('\n');
    const updatedAtIndex = lines.findIndex((line) => line.startsWith('updatedAt: '));
    const statusIndex = lines.findIndex((line) => line.startsWith('status: '));
    if (updatedAtIndex < 0 || statusIndex < 0) throw new Error('setup: frontmatter lines missing');
    [lines[updatedAtIndex]!, lines[statusIndex]!] = [lines[statusIndex]!, lines[updatedAtIndex]!];
    const byteDifferentDraft = lines.join('\n');
    expect(byteDifferentDraft).not.toBe(publishedSource);
    const committed = await adapter.commitFile({
      branch: branchName,
      path,
      content: byteDifferentDraft,
      message: 'Studio: save draft for a-published-article',
      expectedHeadSha: branch.value.sha,
    });
    if (!committed.ok) throw new Error('commit failed');
    const created = await adapter.createPullRequest({
      title: 'Studio draft',
      body: 'Studio draft',
      head: branchName,
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result).toEqual({ kind: 'unpublish_blocked', reason: 'differing-draft' });
    // Zero writes: the branch head is untouched, the Draft PR is still open
    // and a draft, and main is byte-identical.
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).toBe(committed.value.commitSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: created.value.number, draft: true, state: 'open' }),
    ]);
    const mainFile = await adapter.getFileContent('main', path);
    expect(mainFile.ok && mainFile.value.content).toBe(publishedSource);
  });

  it('constructs the archive commit by replacing only the canonical status value, byte for byte', async () => {
    const adapter = new FakeGithubAdapter(config);
    // A hand-authored canonical whose YAML formatting is not the compiler's
    // canonical serialization (quoted scalars): the archive commit must
    // preserve every byte except the frontmatter status value.
    const handcraftedCanonical = [
      '---',
      'title: "A Published Article"',
      'slug: a-published-article',
      'excerpt: An article currently published.',
      'publishedAt: "2026-08-01"',
      'updatedAt: "2026-08-01"',
      'status: published',
      'category: Ideas',
      'tags:',
      '  - studio',
      'author: Jelementi',
      'cover:',
      '  src: articles/a-published-article/cover.svg',
      '  alt: A published cover',
      'references: []',
      '---',
      'Published body.',
    ].join('\n');
    adapter.seedFile('main', path, handcraftedCanonical, 'b'.repeat(64));

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result.kind).toBe('unpublish_submitted');
    if (result.kind !== 'unpublish_submitted') return;
    const committed = await branchFileContent(adapter);
    if (committed === undefined) throw new Error('archive commit missing');
    // The committed source differs from canonical ONLY at the status value.
    const statusValueIndex = handcraftedCanonical.indexOf('status: published');
    expect(statusValueIndex).toBeGreaterThanOrEqual(0);
    expect(committed).toBe(
      handcraftedCanonical.slice(0, statusValueIndex + 'status: '.length) +
        'archived' +
        handcraftedCanonical.slice(statusValueIndex + 'status: published'.length),
    );
    const archived = parseArticleSource(committed, path);
    expect(archived.frontmatter.status).toBe('archived');
    expect(archived.body).toBe('Published body.');
  });

  it('fails closed when the canonical status cannot be transformed unambiguously, with zero writes', async () => {
    const adapter = new FakeGithubAdapter(config);
    const ambiguousCanonical = publishedSource.replace(
      'status: published',
      'status: published # release flag',
    );
    adapter.seedFile('main', path, ambiguousCanonical, 'b'.repeat(64));

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result).toEqual({
      kind: 'unpublish_failed',
      phase: 'canonical',
      reason: 'github',
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok).toBe(false);
  });

  it('blocks when an active committed draft differs from canonical main, and never overwrites it', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branch = await adapter.createBranch(branchName, main.value.sha);
    if (!branch.ok) throw new Error('branch missing');
    const differingSource = serializeArticleSource({
      frontmatter: publishedFrontmatter,
      body: 'A differing draft that must block Unpublish.',
    });
    const committed = await adapter.commitFile({
      branch: branchName,
      path,
      content: differingSource,
      message: 'Studio: save draft for a-published-article',
      expectedHeadSha: branch.value.sha,
    });
    if (!committed.ok) throw new Error('commit failed');
    const created = await adapter.createPullRequest({
      title: 'Studio draft',
      body: 'Studio draft',
      head: branchName,
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('pull request missing');

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result).toEqual({ kind: 'unpublish_blocked', reason: 'differing-draft' });
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).toBe(committed.value.commitSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: created.value.number, draft: true, state: 'open' }),
    ]);
    const mainFile = await adapter.getFileContent('main', path);
    expect(mainFile.ok && mainFile.value.content).toBe(publishedSource);
  });

  it('blocks when the canonical article is not published', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    adapter.seedFile(
      'main',
      path,
      serializeArticleSource({
        frontmatter: { ...publishedFrontmatter, status: 'archived' },
        body: 'Already archived body.',
      }),
      'c'.repeat(64),
    );

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result).toEqual({ kind: 'unpublish_blocked', reason: 'not-published' });
  });

  it('creates the branch and Draft PR from scratch when none exists, and never touches main', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result.kind).toBe('unpublish_submitted');
    if (result.kind !== 'unpublish_submitted') return;
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok).toBe(true);
    const mainAfter = await adapter.getMainRef();
    expect(mainAfter.ok && mainAfter.value.sha).toBe(main.value.sha);
    const mainFile = await adapter.getFileContent('main', path);
    expect(mainFile.ok && mainFile.value.content).toBe(publishedSource);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(1);
  });

  it('rejects an archive change that would fail to compile, with zero writes', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublishedArticle(adapter, '# A heading is not supported here');

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result.kind).toBe('unpublish_rejected');
    if (result.kind !== 'unpublish_rejected') return;
    expect(result.compileIssues.length).toBeGreaterThan(0);
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok).toBe(false);
  });

  it('maps a github-side read failure to a phase-named failed result', async () => {
    const adapter = new FakeGithubAdapter(config, { offline: true });

    const result = await unpublishStudioArticle(adapter, slug, unpublishOptions);

    expect(result).toEqual({
      kind: 'unpublish_failed',
      phase: 'main',
      reason: 'github',
    });
  });
});
