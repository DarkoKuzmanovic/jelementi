import { describe, expect, it } from 'vitest';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const BRANCH = 'studio/article/hello-world';

describe('FakeGithubAdapter', () => {
  it('reads main and lists no studio branches initially', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    expect(main.ok).toBe(true);
    if (main.ok) expect(main.value.name).toBe('refs/heads/main');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok).toBe(true);
    if (branches.ok) expect(branches.value).toEqual([]);
  });

  it('creates a studio branch from an observed main SHA', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const created = await adapter.createBranch(BRANCH, main.value.sha);
    expect(created.ok).toBe(true);
    const listed = await adapter.listStudioBranches();
    if (!listed.ok) throw new Error('list failed');
    expect(listed.value.map((branch) => branch.name)).toEqual([BRANCH]);
  });

  it('fails closed on branch creation from an unknown SHA or a duplicate name', async () => {
    const adapter = new FakeGithubAdapter(config);
    const fromUnknown = await adapter.createBranch(BRANCH, 'f'.repeat(40));
    expect(fromUnknown.ok).toBe(false);
    if (!fromUnknown.ok) expect(fromUnknown.failure.reason).toBe('conflict');
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch(BRANCH, main.value.sha);
    const duplicate = await adapter.createBranch(BRANCH, main.value.sha);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.failure.reason).toBe('conflict');
  });

  it('forbids creating or committing to main', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const created = await adapter.createBranch('main', main.value.sha);
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.failure.reason).toBe('forbidden');
    const commit = await adapter.commitFile({
      branch: 'main',
      path: 'content/articles/hello-world.md',
      content: '# Hello',
      message: 'test',
      expectedHeadSha: main.value.sha,
    });
    expect(commit.ok).toBe(false);
    if (!commit.ok) expect(commit.failure.reason).toBe('forbidden');
  });

  it('commits one file with an expected-head precondition and reads it back', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const created = await adapter.createBranch(BRANCH, main.value.sha);
    if (!created.ok) throw new Error('create failed');
    const stale = await adapter.commitFile({
      branch: BRANCH,
      path: 'content/articles/hello-world.md',
      content: '# v1',
      message: 'save 1',
      expectedHeadSha: 'f'.repeat(40),
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.failure.reason).toBe('conflict');

    const first = await adapter.commitFile({
      branch: BRANCH,
      path: 'content/articles/hello-world.md',
      content: '# v1',
      message: 'save 1',
      expectedHeadSha: created.value.sha,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('commit failed');
    expect(first.value.blobSha).toMatch(/^[0-9a-f]{40}$/);
    expect(first.value.blobSha).not.toBe(first.value.commitSha);

    const file = await adapter.getFileContent(BRANCH, 'content/articles/hello-world.md');
    expect(file.ok).toBe(true);
    if (file.ok) {
      expect(file.value.content).toBe('# v1');
      expect(file.value.blobSha).toBe(first.value.blobSha);
    }
  });

  it('creates one draft PR per branch and rejects a second open PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch(BRANCH, main.value.sha);
    const first = await adapter.createPullRequest({
      title: 'Hello',
      body: 'body',
      head: BRANCH,
      base: 'main',
      draft: true,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.draft).toBe(true);
      expect(first.value.headRef).toBe(BRANCH);
    }
    const second = await adapter.createPullRequest({
      title: 'Hello again',
      body: 'body',
      head: BRANCH,
      base: 'main',
      draft: true,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.failure.reason).toBe('topology');
  });

  it('flips a draft PR ready and enables auto-merge only for the expected head', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch(BRANCH, main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Hello',
      body: 'body',
      head: BRANCH,
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('create failed');
    const committed = await adapter.commitFile({
      branch: BRANCH,
      path: 'content/articles/hello-world.md',
      content: '# committed',
      message: 'save',
      expectedHeadSha: created.value.headSha,
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error('commit failed');

    const flipped = await adapter.updatePullRequest(created.value.number, { draft: false });
    expect(flipped.ok).toBe(true);
    if (flipped.ok) expect(flipped.value.draft).toBe(false);

    const wrongHead = await adapter.enableAutoMerge(created.value.number, 'f'.repeat(40));
    expect(wrongHead.ok).toBe(false);
    if (!wrongHead.ok) expect(wrongHead.failure.reason).toBe('conflict');

    const staleHead = await adapter.enableAutoMerge(created.value.number, created.value.headSha);
    expect(staleHead.ok).toBe(false);
    if (!staleHead.ok) expect(staleHead.failure.reason).toBe('conflict');

    const autoMerge = await adapter.enableAutoMerge(
      created.value.number,
      committed.value.commitSha,
    );
    expect(autoMerge.ok).toBe(true);
  });

  it('reports check runs by head SHA and returns null for unknown names', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch(BRANCH, main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Hello',
      body: 'body',
      head: BRANCH,
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('create failed');
    adapter.seedCheckRun(created.value.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'success',
    });
    const run = await adapter.getCheckRun(created.value.number, 'verify');
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(run.value?.name).toBe('verify');
      expect(run.value?.conclusion).toBe('success');
    }
    const missing = await adapter.getCheckRun(created.value.number, 'nope');
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.value).toBeNull();
  });

  it('closes a PR and deletes a branch only at the expected head', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await adapter.createBranch(BRANCH, main.value.sha);
    const created = await adapter.createPullRequest({
      title: 'Hello',
      body: 'body',
      head: BRANCH,
      base: 'main',
      draft: true,
    });
    if (!created.ok) throw new Error('create failed');

    const wrongHead = await adapter.deleteBranch(BRANCH, 'f'.repeat(40));
    expect(wrongHead.ok).toBe(false);
    if (!wrongHead.ok) expect(wrongHead.failure.reason).toBe('conflict');

    const closed = await adapter.closePullRequest(created.value.number);
    expect(closed.ok).toBe(true);
    const deleted = await adapter.deleteBranch(BRANCH, created.value.headSha);
    expect(deleted.ok).toBe(true);
    const gone = await adapter.getBranch(BRANCH);
    expect(gone.ok).toBe(false);
    if (!gone.ok) expect(gone.failure.reason).toBe('not-found');
  });

  it('fails every call with a stable reason when offline or unauthorized', async () => {
    const offline = new FakeGithubAdapter(config, { offline: true });
    const main = await offline.getMainRef();
    expect(main.ok).toBe(false);
    if (!main.ok) expect(main.failure.reason).toBe('transport');

    const unauthorized = new FakeGithubAdapter(config, { unauthorized: true });
    const branches = await unauthorized.listStudioBranches();
    expect(branches.ok).toBe(false);
    if (!branches.ok) expect(branches.failure.reason).toBe('auth');
  });
});
