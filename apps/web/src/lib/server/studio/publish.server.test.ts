import { describe, expect, it, vi } from 'vitest';
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

const mediaExists: typeof globalThis.fetch = async () => new Response(null, { status: 200 });
const previewOptions = {
  mediaBaseUrl: 'https://media.jelementi.quz.ma/',
  fetch: mediaExists,
};
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

  it('rejects a missing cover before making the Draft PR ready', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const missingMedia: typeof globalThis.fetch = async () => new Response(null, { status: 404 });

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      { ...previewOptions, fetch: missingMedia },
    );

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [
        expect.objectContaining({
          code: 'MEDIA_UNAVAILABLE',
          message:
            'Article media "https://media.jelementi.quz.ma/articles/a-draft-article/cover.svg" is unavailable: HTTP 404.',
          sourcePath: path,
        }),
      ],
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('rejects a missing body image before making the Draft PR ready', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, '![A map](articles/a-draft-article/map-v1.svg)');
    const missingBodyImage: typeof globalThis.fetch = async (input) =>
      new Response(null, { status: String(input).endsWith('/map-v1.svg') ? 404 : 200 });

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      { ...previewOptions, fetch: missingBodyImage },
    );

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [expect.objectContaining({ code: 'MEDIA_UNAVAILABLE', sourcePath: path })],
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('rejects missing optional audio before making the Draft PR ready', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, 'Saved body.', {
      ...metadata,
      audio: { src: 'articles/a-draft-article/audio-v1.m4a', durationSeconds: 120 },
    });
    const missingAudio: typeof globalThis.fetch = async (input) =>
      new Response(null, { status: String(input).endsWith('/audio-v1.m4a') ? 404 : 200 });

    const result = await publishStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      { ...previewOptions, fetch: missingAudio },
    );

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [expect.objectContaining({ code: 'MEDIA_UNAVAILABLE', sourcePath: path })],
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('bounds a stalled media preflight and leaves the Draft PR untouched', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const stalledMedia: typeof globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });

    const result = await Promise.race([
      publishStudioDraft(adapter, slug, saved.concurrency.draftHeadSha as string, {
        ...previewOptions,
        fetch: stalledMedia,
        mediaTimeoutMs: 10,
      }),
      new Promise<'not-bounded'>((resolve) => setTimeout(() => resolve('not-bounded'), 100)),
    ]);

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [
        expect.objectContaining({
          code: 'MEDIA_UNAVAILABLE',
          message:
            'Article media "https://media.jelementi.quz.ma/articles/a-draft-article/cover.svg" is unavailable: request timed out.',
          sourcePath: path,
        }),
      ],
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
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

  it('flips a committed draft to published with one byte-minimal commit bound to the post-flip head (#111 Design A)', async () => {
    const adapter = new FakeGithubAdapter(config);
    // Valid, compilable draft whose frontmatter status is still 'draft' —
    // the ordinary first-publication state now that the editor form cannot
    // mark a new draft `published`.
    const saved = await seedSavedDraft(adapter, 'A perfectly valid body.', {
      ...metadata,
      status: 'draft',
    });
    const approvedHeadSha = saved.concurrency.draftHeadSha as string;
    const commitFileSpy = vi.spyOn(adapter, 'commitFile');
    const autoMergeSpy = vi.spyOn(adapter, 'enableAutoMerge');

    const result = await publishStudioDraft(adapter, slug, approvedHeadSha, previewOptions);

    expect(result.kind).toBe('published');
    if (result.kind !== 'published') return;
    // The approval chain advanced exactly once: the status-flip commit.
    expect(result.headSha).not.toBe(approvedHeadSha);
    expect(commitFileSpy).toHaveBeenCalledTimes(1); // the flip (spy post-seed)
    const flipCall = commitFileSpy.mock.calls[0]?.[0];
    expect(flipCall).toMatchObject({
      branch: branchName,
      path,
      expectedHeadSha: approvedHeadSha,
      message: expect.stringContaining('publish'),
    });
    expect(flipCall?.content).toContain('status: published');
    expect(flipCall?.content).not.toContain('status: draft');
    // Byte-minimal: everything except the status value is untouched.
    expect(flipCall?.content).toContain('A perfectly valid body.');
    // Ready + auto-merge are bound to the POST-flip head (stories 23/27).
    expect(autoMergeSpy).toHaveBeenCalledWith(saved.pullRequest.number, result.headSha);
    const committed = await adapter.getFileContent(result.headSha, path);
    if (!committed.ok) throw new Error('committed flipped blob missing');
    expect(committed.value.content).toContain('status: published');
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, draft: false, state: 'open' }),
    ]);
  });

  it('rejects failing media BEFORE the flip commit: every rejection leaves the branch untouched (#111 Design A)', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, 'A perfectly valid body.', {
      ...metadata,
      status: 'draft',
    });
    const approvedHeadSha = saved.concurrency.draftHeadSha as string;
    const missingMedia: typeof globalThis.fetch = async () => new Response(null, { status: 404 });
    const commitFileSpy = vi.spyOn(adapter, 'commitFile');
    const autoMergeSpy = vi.spyOn(adapter, 'enableAutoMerge');

    const result = await publishStudioDraft(adapter, slug, approvedHeadSha, {
      ...previewOptions,
      fetch: missingMedia,
    });

    expect(result).toEqual({
      kind: 'publish_rejected',
      compileIssues: [expect.objectContaining({ code: 'MEDIA_UNAVAILABLE', sourcePath: path })],
    });
    // Zero writes: the media preflight ran against the flipped candidate
    // before any commit could land.
    expect(commitFileSpy).not.toHaveBeenCalled();
    expect(autoMergeSpy).not.toHaveBeenCalled();
    const committed = await adapter.getFileContent(approvedHeadSha, path);
    if (!committed.ok) throw new Error('committed draft missing');
    expect(committed.value.content).toContain('status: draft');
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, draft: true, state: 'open' }),
    ]);
  });

  it('fails closed without writing when the published form cannot be derived unambiguously', async () => {
    const adapter = new FakeGithubAdapter(config);
    const headSha = 'e'.repeat(40);
    adapter.seedBranch(branchName, headSha);
    // No frontmatter block at all: the tolerant status read falls back to
    // `draft`, but the byte-minimal flip has nothing unambiguous to rewrite.
    adapter.seedFile(branchName, path, 'Just prose, no frontmatter block.', 'c'.repeat(40));
    adapter.seedPullRequest(branchName, { draft: true, headSha });
    const commitFileSpy = vi.spyOn(adapter, 'commitFile');

    const result = await publishStudioDraft(adapter, slug, headSha, previewOptions);

    expect(result).toEqual({
      kind: 'publish_failed',
      phase: 'status-flip',
      reason: 'transform',
    });
    expect(commitFileSpy).not.toHaveBeenCalled();
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('skips the flip when the committed draft already says published', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const approvedHeadSha = saved.concurrency.draftHeadSha as string;
    const commitFileSpy = vi.spyOn(adapter, 'commitFile');
    const autoMergeSpy = vi.spyOn(adapter, 'enableAutoMerge');

    const result = await publishStudioDraft(adapter, slug, approvedHeadSha, previewOptions);

    expect(result).toEqual({
      kind: 'published',
      pullRequest: { number: saved.pullRequest.number, url: saved.pullRequest.url },
      headSha: approvedHeadSha,
    });
    expect(commitFileSpy).not.toHaveBeenCalled();
    expect(autoMergeSpy).toHaveBeenCalledWith(saved.pullRequest.number, approvedHeadSha);
  });

  it('keeps archived drafts blocked from Publish with no mutation (#111)', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, 'An archived body.', {
      ...metadata,
      status: 'archived',
    });
    const commitFileSpy = vi.spyOn(adapter, 'commitFile');
    const autoMergeSpy = vi.spyOn(adapter, 'enableAutoMerge');

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
    // Archived stays blocked and byte-for-byte untouched.
    expect(commitFileSpy).not.toHaveBeenCalled();
    expect(autoMergeSpy).not.toHaveBeenCalled();
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('fails closed when the branch moves between validation and the status flip', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter, 'A perfectly valid body.', {
      ...metadata,
      status: 'draft',
    });
    const approvedHeadSha = saved.concurrency.draftHeadSha as string;
    // The flip's own expected-head precondition detects the race.
    vi.spyOn(adapter, 'commitFile').mockImplementationOnce(async () => ({
      ok: false as const,
      failure: { operation: 'commit-file', reason: 'conflict' } as const,
    }));
    const autoMergeSpy = vi.spyOn(adapter, 'enableAutoMerge');

    const result = await publishStudioDraft(adapter, slug, approvedHeadSha, previewOptions);

    expect(result.kind).toBe('publish_conflict');
    if (result.kind !== 'publish_conflict') return;
    expect(result.expectedHeadSha).toBe(approvedHeadSha);
    // No readiness flip or merge approval ever happened.
    expect(autoMergeSpy).not.toHaveBeenCalled();
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, draft: true, state: 'open' }),
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
