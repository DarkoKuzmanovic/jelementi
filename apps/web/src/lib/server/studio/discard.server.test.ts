import { describe, expect, it, vi } from 'vitest';
import type { StudioMetadata } from '../../studio/contracts';
import { FakeGithubAdapter } from './github-adapter.fake';
import { saveStudioDraft } from './editor.server';
import { discardStudioDraft } from './discard.server';
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

const metadata: StudioMetadata = {
  title: 'A Draft Article',
  slug,
  excerpt: 'An article being written in Studio.',
  status: 'draft',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover.svg', alt: 'A draft cover' },
  references: [],
};

/** Drives a real Save so Discard tests run against realistic saved state. */
async function seedSavedDraft(adapter: FakeGithubAdapter, body = 'Saved body.') {
  const main = await adapter.getMainRef();
  if (!main.ok) throw new Error('main missing');
  const saved = await saveStudioDraft(
    adapter,
    slug,
    { metadata, body, concurrency: { baseMainSha: main.value.sha } },
    previewOptions,
  );
  if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
  return saved;
}

describe('discardStudioDraft', () => {
  it('closes the sole Draft PR and deletes only the branch, leaving main byte-identical', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const mainFile = await adapter.getFileContent('main', 'content/articles/a-draft-article.md');
    if (mainFile.ok) throw new Error('setup: main must not contain the draft article');

    const result = await discardStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
    );

    expect(result).toEqual({
      kind: 'discarded',
      pullRequest: { number: saved.pullRequest.number, url: saved.pullRequest.url },
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok).toBe(false);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, state: 'closed' }),
    ]);
    const mainAfter = await adapter.getMainRef();
    expect(mainAfter.ok && mainAfter.value.sha).toBe(main.value.sha);
    const mainFileAfter = await adapter.getFileContent(
      'main',
      'content/articles/a-draft-article.md',
    );
    expect(mainFileAfter.ok).toBe(false);
  });

  it('discards a ready Draft PR after its required check fails, leaving main unchanged', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const ready = await adapter.updatePullRequest(saved.pullRequest.number, { draft: false });
    if (!ready.ok) throw new Error('setup: PR must become ready');
    adapter.seedCheckRun(saved.pullRequest.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/49',
    });

    const result = await discardStudioDraft(
      adapter,
      slug,
      saved.concurrency.draftHeadSha as string,
    );

    expect(result).toEqual({
      kind: 'discarded',
      pullRequest: { number: saved.pullRequest.number, url: saved.pullRequest.url },
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok).toBe(false);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: false, state: 'closed' }),
    ]);
    const mainAfter = await adapter.getMainRef();
    expect(mainAfter.ok && mainAfter.value.sha).toBe(main.value.sha);
  });

  it('blocks deletion when the expected head no longer matches the branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const expectedHeadSha = saved.concurrency.draftHeadSha as string;
    const moved = await adapter.commitFile({
      branch: branchName,
      path: 'content/articles/a-draft-article.md',
      content: 'A newer committed draft.',
      message: 'Studio: save draft for a-draft-article',
      expectedHeadSha,
    });
    if (!moved.ok) throw new Error('setup: commit must succeed');

    const result = await discardStudioDraft(adapter, slug, expectedHeadSha);

    expect(result).toEqual({
      kind: 'discard_conflict',
      expectedHeadSha,
      currentHeadSha: moved.value.commitSha,
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(moved.value.commitSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ draft: true, state: 'open' }),
    ]);
  });

  it('reports a conflict with a null current head when the branch is gone entirely', async () => {
    const adapter = new FakeGithubAdapter(config);

    const result = await discardStudioDraft(adapter, slug, 'b'.repeat(40));

    expect(result).toEqual({
      kind: 'discard_conflict',
      expectedHeadSha: 'b'.repeat(40),
      currentHeadSha: null,
    });
  });

  it('fails closed as topology when the sole open Draft PR targets the wrong base', async () => {
    const adapter = new FakeGithubAdapter(config);
    await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    const pulls = await adapter.listPullRequests(branchName);
    if (!pulls.ok || pulls.value.length !== 1) throw new Error('setup: one PR expected');
    vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
      ok: true,
      value: [{ ...pulls.value[0]!, draft: false, baseRef: 'develop' }],
    });

    const result = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(result).toEqual({
      kind: 'discard_failed',
      phase: 'pull-request',
      reason: 'topology',
    });
    expect(await adapter.getBranch(branchName)).toEqual({ ok: true, value: branch.value });
  });

  it('fails closed as topology when more than one open Draft PR exists for the branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    adapter.seedPullRequest(branchName, {
      draft: true,
      headSha: saved.concurrency.draftHeadSha,
    });
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');

    const result = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(result).toEqual({
      kind: 'discard_failed',
      phase: 'pull-request',
      reason: 'topology',
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(2);
  });

  it('names the failed phase when closing the PR fails, and a retry then completes the discard', async () => {
    const adapter = new FakeGithubAdapter(config);
    await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    vi.spyOn(adapter, 'closePullRequest').mockResolvedValueOnce({
      ok: false,
      failure: { operation: 'close-pull-request', reason: 'transport' },
    });

    const first = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(first).toEqual({
      kind: 'discard_failed',
      phase: 'close-pull-request',
      reason: 'github',
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ state: 'open', draft: true }),
    ]);

    // Retry rediscovers the same topology and completes without duplicates.
    const second = await discardStudioDraft(adapter, slug, branch.value.sha);
    expect(second.kind).toBe('discarded');
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok).toBe(false);
  });

  it('names the failed phase when branch deletion fails, and a retry resumes from the closed PR without duplicates', async () => {
    const adapter = new FakeGithubAdapter(config);
    await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    vi.spyOn(adapter, 'deleteBranch').mockResolvedValueOnce({
      ok: false,
      failure: { operation: 'delete-branch', reason: 'transport' },
    });

    const first = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(first).toEqual({
      kind: 'discard_failed',
      phase: 'delete-branch',
      reason: 'github',
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([expect.objectContaining({ state: 'closed' })]);

    // The PR is already closed; the retry re-reads that and only deletes the
    // branch — no duplicate close, no second PR.
    const second = await discardStudioDraft(adapter, slug, branch.value.sha);
    expect(second.kind).toBe('discarded');
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok).toBe(false);
    const pullsAfter = await adapter.listPullRequests(branchName);
    expect(pullsAfter.ok && pullsAfter.value).toHaveLength(1);
  });

  it('recovers a delete-failed discard by matching the closed PR to the current head, ignoring unrelated historical PRs', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    vi.spyOn(adapter, 'deleteBranch').mockResolvedValueOnce({
      ok: false,
      failure: { operation: 'delete-branch', reason: 'transport' },
    });

    const first = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(first).toEqual({
      kind: 'discard_failed',
      phase: 'delete-branch',
      reason: 'github',
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, state: 'closed' }),
    ]);

    // An unrelated historical closed Draft PR for the same branch (an earlier
    // abandoned draft) must not break recovery: only the closed PR whose head
    // equals the branch's current head was closed by this Discard.
    adapter.seedPullRequest(branchName, {
      state: 'closed',
      headSha: 'c'.repeat(40),
      draft: true,
    });

    const second = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(second).toEqual({
      kind: 'discarded',
      pullRequest: { number: saved.pullRequest.number, url: saved.pullRequest.url },
    });
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok).toBe(false);
    const pullsAfter = await adapter.listPullRequests(branchName);
    expect(pullsAfter.ok && pullsAfter.value).toHaveLength(2);
  });

  it('fails closed when no closed PR matches the branch head, leaving the branch intact', async () => {
    const adapter = new FakeGithubAdapter(config);
    await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    const pulls = await adapter.listPullRequests(branchName);
    if (!pulls.ok || pulls.value.length !== 1) throw new Error('setup: one PR expected');
    // The only PR history shows a closed PR whose head is NOT the current
    // branch head — an unrelated historical Draft PR. With no matching
    // candidate, recovery must fail topology instead of deleting the branch.
    vi.spyOn(adapter, 'listPullRequests').mockResolvedValue({
      ok: true,
      value: [{ ...pulls.value[0]!, state: 'closed', headSha: 'c'.repeat(40) }],
    });

    const result = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(result).toEqual({
      kind: 'discard_failed',
      phase: 'pull-request',
      reason: 'topology',
    });
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).toBe(branch.value.sha);
  });

  it('fails closed when more than one closed PR matches the branch head (ambiguous recovery)', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    await adapter.closePullRequest(saved.pullRequest.number);
    // A duplicate closed PR with the same head as the branch: recovery cannot
    // tell which one this Discard actually closed.
    adapter.seedPullRequest(branchName, {
      state: 'closed',
      headSha: branch.value.sha,
      draft: true,
    });

    const result = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(result).toEqual({
      kind: 'discard_failed',
      phase: 'pull-request',
      reason: 'topology',
    });
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok).toBe(true);
  });

  it('surfaces a delete conflict as discard_conflict with the fresh current head', async () => {
    const adapter = new FakeGithubAdapter(config);
    const saved = await seedSavedDraft(adapter);
    const branch = await adapter.getBranch(branchName);
    if (!branch.ok) throw new Error('branch missing');
    // A concurrent write moves the branch head between Discard's own fresh
    // check and the branch deletion, so the DELETE itself reports a conflict.
    let movedHeadSha = '';
    vi.spyOn(adapter, 'deleteBranch').mockImplementationOnce(async (name, expectedHeadSha) => {
      const current = await adapter.getBranch(name);
      if (!current.ok) throw new Error('setup: branch missing');
      const moved = await adapter.commitFile({
        branch: name,
        path: 'content/articles/a-draft-article.md',
        content: 'A concurrent commit moved the head.',
        message: 'concurrent edit',
        expectedHeadSha: current.value.sha,
      });
      if (!moved.ok) throw new Error('setup: concurrent commit failed');
      movedHeadSha = moved.value.commitSha;
      return adapter.deleteBranch(name, expectedHeadSha);
    });

    const result = await discardStudioDraft(adapter, slug, branch.value.sha);

    expect(result).toEqual({
      kind: 'discard_conflict',
      expectedHeadSha: branch.value.sha,
      currentHeadSha: movedHeadSha,
    });
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).toBe(movedHeadSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, state: 'closed' }),
    ]);
  });

  it('maps a github-side branch read failure to a phase-named failed result', async () => {
    const adapter = new FakeGithubAdapter(config, { offline: true });

    const result = await discardStudioDraft(adapter, slug, 'b'.repeat(40));

    expect(result).toEqual({
      kind: 'discard_failed',
      phase: 'branch',
      reason: 'github',
    });
  });
});
