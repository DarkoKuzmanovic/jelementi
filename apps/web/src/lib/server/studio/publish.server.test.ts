import { describe, expect, it } from 'vitest';
import { serializeArticleSource } from '@jelementi/content-compiler';
import type { StudioMetadata } from '../../studio/contracts';
import { FakeGithubAdapter } from './github-adapter.fake';
import { saveStudioDraft } from './editor.server';
import { publishStudioDraft } from './publish.server';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const previewOptions = { mediaBaseUrl: 'https://media.jelementi.quz.ma/' };
const slug = 'a-draft-article';
const branchName = `studio/article/${slug}`;
const path = `content/articles/${slug}.md`;

const metadata: StudioMetadata = {
  title: 'A Draft Article',
  slug,
  excerpt: 'An article being written in Studio.',
  status: 'published',
  publishedAt: '2026-08-01',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover.svg', alt: 'A draft cover' },
  references: [],
};

/** Drives a real Save so tests publish against realistic, saved state. */
async function seedSavedDraft(
  adapter: FakeGithubAdapter,
  body = 'Saved body.',
  overrideMetadata: StudioMetadata = metadata,
) {
  const main = await adapter.getMainRef();
  if (!main.ok) throw new Error('main missing');
  const saved = await saveStudioDraft(
    adapter,
    slug,
    { metadata: overrideMetadata, body, concurrency: { baseMainSha: main.value.sha } },
    previewOptions,
  );
  if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
  return saved;
}

describe('publishStudioDraft', () => {
  it('revalidates the exact committed draft, flips the Draft PR ready, and enables auto-merge for the expected head', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'published',
      pullRequest: { number: saved.pullRequest.number, url: saved.pullRequest.url },
      headSha: saved.concurrency.draftHeadSha,
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, draft: false, state: 'open' }),
    ]);
  });

  it('is idempotent: publishing again at the same still-current head still succeeds', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const headSha = saved.concurrency.draftHeadSha as string;

    await publishStudioDraft(adapter, slug, headSha, previewOptions);
    const second = await publishStudioDraft(adapter, slug, headSha, previewOptions);

    expect(second.kind).toBe('published');
  });

  it('rejects a changed expected head (no mutation after approval, ADR-0004)', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const approvedHeadSha = saved.concurrency.draftHeadSha as string;

    // A further commit lands on the branch after the operator's approval
    // snapshot was taken (e.g. a race with another Save).
    const moved = await adapter.commitFile({
      branch: branchName,
      path,
      content: 'irrelevant, only the head must move',
      message: 'Studio: save draft for a-draft-article',
      expectedHeadSha: approvedHeadSha,
    });
    if (!moved.ok) throw new Error('setup: commit must succeed');

    const result = await publishStudioDraft(adapter, slug, approvedHeadSha, previewOptions);

    expect(result).toEqual({
      kind: 'publish_conflict',
      expectedHeadSha: approvedHeadSha,
      currentHeadSha: moved.value.commitSha,
    });
    // The PR must still be open and untouched by the rejected approval.
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, draft: true, state: 'open' }),
    ]);
  });

  it('reports a conflict with a null current head when the branch is gone entirely', async () => {
    const adapter = new FakeGithubAdapter(config);

    const result = await publishStudioDraft(adapter, slug, 'b'.repeat(40), previewOptions);

    expect(result).toEqual({
      kind: 'publish_conflict',
      expectedHeadSha: 'b'.repeat(40),
      currentHeadSha: null,
    });
  });

  it('rejects a non-published article status: nothing unpublishable proceeds past Publish (spec §Publish step 4)', async () => {
    const adapter = new FakeGithubAdapter(config);
    // Valid, compilable draft — but its frontmatter status is still 'draft',
    // so it can never appear in the published index or be proven Live.
    const saved = await seedSavedDraft(adapter, 'A perfectly valid body.', {
      ...metadata,
      status: 'draft',
    });

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [expect.objectContaining({ code: 'UNPUBLISHABLE_STATUS', sourcePath: path })],
    });
    // The PR must remain an untouched open Draft.
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('rejects a change that would fail to compile, and leaves GitHub untouched', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, '# A heading is not supported here');

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      previewOptions,
    );

    expect(result.kind).toBe('publish_rejected');
    if (result.kind !== 'publish_rejected') return;
    expect(result.compileIssues.length).toBeGreaterThan(0);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('fails closed as unexpected topology when the branch has no open PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    const headSha = 'e'.repeat(40);
    adapter.seedBranch(branchName, headSha);
    adapter.seedFile(
      branchName,
      path,
      serializeArticleSource({ frontmatter: metadata, body: 'Valid body.' }),
      'c'.repeat(40),
    );

    const result = await publishStudioDraft(adapter, slug, headSha, previewOptions);

    expect(result).toEqual({
      kind: 'publish_failed',
      phase: 'pull-request',
      reason: 'topology',
    });
  });

  it('fails closed as unexpected topology when more than one open PR exists for the branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    adapter.seedPullRequest(branchName, {
      draft: true,
      headSha: saved.concurrency.draftHeadSha,
    });

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      previewOptions,
    );

    expect(result).toEqual({ kind: 'publish_failed', phase: 'pull-request', reason: 'topology' });
  });

  it('reports a conflict when the discovered PR head disagrees with the branch head', async () => {
    const adapter = new FakeGithubAdapter(config);
    const headSha = 'e'.repeat(40);
    adapter.seedBranch(branchName, headSha);
    adapter.seedFile(
      branchName,
      path,
      serializeArticleSource({ frontmatter: metadata, body: 'Valid body.' }),
      'c'.repeat(40),
    );
    const stalePullHeadSha = 'd'.repeat(40);
    adapter.seedPullRequest(branchName, { draft: true, headSha: stalePullHeadSha });

    const result = await publishStudioDraft(adapter, slug, headSha, previewOptions);

    expect(result).toEqual({
      kind: 'publish_conflict',
      expectedHeadSha: headSha,
      currentHeadSha: stalePullHeadSha,
    });
  });

  it('maps a github-side branch read failure to a phase-named failed result', async () => {
    const adapter = new FakeGithubAdapter(config, { offline: true });

    const result = await publishStudioDraft(adapter, slug, 'b'.repeat(40), previewOptions);

    expect(result).toEqual({ kind: 'publish_failed', phase: 'branch', reason: 'github' });
  });
});
