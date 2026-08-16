import { serializeArticleSource, type ArticleSourceFrontmatter } from '@jelementi/content-compiler';
import { describe, expect, it } from 'vitest';
import type { StudioMetadata } from '../../studio/contracts';
import type { StudioGithubConfig } from './config.server';
import type {
  CommitFileInput,
  CreatePullRequestInput,
  GithubAdapterResult,
  StudioBranch,
  StudioCommitFileResult,
  StudioGithubOperation,
  StudioPullRequest,
} from './github-adapter';
import { replaceStudioDraft } from './draft-replacement.server';
import { saveStudioDraft } from './editor.server';
import { FakeGithubAdapter } from './github-adapter.fake';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const slug = 'replacement-article';
const path = `content/articles/${slug}.md`;
const branchName = `studio/article/${slug}`;
const mediaBaseUrl = 'https://media.jelementi.quz.ma/';
const frontmatter: ArticleSourceFrontmatter = {
  title: 'Replacement Article',
  slug,
  excerpt: 'A safely replaced Studio draft.',
  publishedAt: '2026-08-20',
  updatedAt: '2026-08-20',
  status: 'published',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: `articles/${slug}/cover.svg`, alt: 'Replacement cover' },
  references: [],
};
const metadata: StudioMetadata = { ...frontmatter, references: [] };

function seedCanonical(adapter: FakeGithubAdapter): void {
  adapter.seedFile(
    'main',
    path,
    serializeArticleSource({ frontmatter, body: 'Canonical body.' }),
    'b'.repeat(40),
  );
}

class EventuallyClosedAdapter extends FakeGithubAdapter {
  staleClosedReads = 0;

  override async listPullRequests(head: string): Promise<GithubAdapterResult<StudioPullRequest[]>> {
    const result = await super.listPullRequests(head);
    if (
      !result.ok ||
      this.staleClosedReads === 0 ||
      !result.value.some((pull) => pull.state === 'closed')
    ) {
      return result;
    }
    this.staleClosedReads -= 1;
    return {
      ok: true,
      value: result.value.map((pull) =>
        pull.state === 'closed' ? { ...pull, state: 'open' as const } : pull,
      ),
    };
  }
}

class PublishRaceAdapter extends FakeGithubAdapter {
  autoMergeAfterClose?: GithubAdapterResult<void>;

  override async closePullRequest(number: number): Promise<GithubAdapterResult<void>> {
    const pulls = await super.listPullRequests(branchName);
    const pull = pulls.ok
      ? pulls.value.find((candidate) => candidate.number === number)
      : undefined;
    if (pull === undefined) throw new Error('race pull missing');
    const ready = await super.updatePullRequest(number, { draft: false });
    if (!ready.ok) throw new Error('race could not mark ready');
    const closed = await super.closePullRequest(number);
    this.autoMergeAfterClose = await super.enableAutoMerge(number, pull.headSha);
    return closed;
  }
}

class SaveRaceAdapter extends FakeGithubAdapter {
  raceOnDelete = false;
  concurrentCommit?: StudioCommitFileResult;

  override async deleteBranch(
    name: string,
    expectedHeadSha: string,
  ): Promise<GithubAdapterResult<void>> {
    if (this.raceOnDelete) {
      this.raceOnDelete = false;
      const committed = await super.commitFile({
        branch: name,
        path,
        content: serializeArticleSource({ frontmatter, body: 'Concurrent Save wins.' }),
        message: 'Concurrent Studio Save',
        expectedHeadSha,
      });
      if (!committed.ok) throw new Error('concurrent save failed');
      this.concurrentCommit = committed.value;
    }
    return super.deleteBranch(name, expectedHeadSha);
  }
}

class LostCommitResponseAdapter extends FakeGithubAdapter {
  private commitCount = 0;

  override async commitFile(
    input: CommitFileInput,
  ): Promise<GithubAdapterResult<StudioCommitFileResult>> {
    this.commitCount += 1;
    const result = await super.commitFile(input);
    if (this.commitCount === 2 && result.ok) {
      return { ok: false, failure: { operation: 'commit-file', reason: 'transport' } };
    }
    return result;
  }
}

class LostCloseResponseAdapter extends FakeGithubAdapter {
  private loseNextCloseResponse = true;

  override async closePullRequest(number: number): Promise<GithubAdapterResult<void>> {
    const result = await super.closePullRequest(number);
    if (this.loseNextCloseResponse && result.ok) {
      this.loseNextCloseResponse = false;
      return { ok: false, failure: { operation: 'close-pull-request', reason: 'transport' } };
    }
    return result;
  }
}

class LostCreateBranchResponseAdapter extends FakeGithubAdapter {
  private createCount = 0;

  override async createBranch(
    name: string,
    fromSha: string,
  ): Promise<GithubAdapterResult<StudioBranch>> {
    this.createCount += 1;
    const result = await super.createBranch(name, fromSha);
    if (this.createCount === 2 && result.ok) {
      return { ok: false, failure: { operation: 'create-branch', reason: 'transport' } };
    }
    return result;
  }
}

class LostDeleteResponseAdapter extends FakeGithubAdapter {
  private loseNextDeleteResponse = true;

  override async deleteBranch(
    name: string,
    expectedHeadSha: string,
  ): Promise<GithubAdapterResult<void>> {
    const result = await super.deleteBranch(name, expectedHeadSha);
    if (this.loseNextDeleteResponse && result.ok) {
      this.loseNextDeleteResponse = false;
      return { ok: false, failure: { operation: 'delete-branch', reason: 'transport' } };
    }
    return result;
  }
}

class MergedPullDiscoveryAdapter extends FakeGithubAdapter {
  reportMerged = false;

  override async listPullRequests(head: string): Promise<GithubAdapterResult<StudioPullRequest[]>> {
    const result = await super.listPullRequests(head);
    if (!this.reportMerged || !result.ok) return result;
    return {
      ok: true,
      value: result.value.map((pull) => ({
        ...pull,
        state: 'merged',
        draft: false,
        mergeCommitSha: 'd'.repeat(40),
      })),
    };
  }
}

class TargetMovesBeforeConfirmationAdapter extends FakeGithubAdapter {
  private createCount = 0;
  movedMainSha?: string;

  override async createPullRequest(
    input: CreatePullRequestInput,
  ): Promise<GithubAdapterResult<StudioPullRequest>> {
    this.createCount += 1;
    const result = await super.createPullRequest(input);
    if (this.createCount === 2 && result.ok) {
      this.movedMainSha = this.advanceMain({
        path,
        content: serializeArticleSource({
          frontmatter,
          body: 'Canonical changed during recovery.',
        }),
        blobSha: '9'.repeat(40),
      });
    }
    return result;
  }
}

class LostCreatePullResponseAdapter extends FakeGithubAdapter {
  private createCount = 0;

  override async createPullRequest(
    input: CreatePullRequestInput,
  ): Promise<GithubAdapterResult<StudioPullRequest>> {
    this.createCount += 1;
    const result = await super.createPullRequest(input);
    if (this.createCount === 2 && result.ok) {
      return {
        ok: false,
        failure: { operation: 'create-pull-request', reason: 'transport' },
      };
    }
    return result;
  }
}

describe('replaceStudioDraft', () => {
  it('replaces a stale Draft from fresh main and requires a new Draft PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    const freshMainSha = adapter.advanceMain();
    const candidate = { metadata, body: 'Preserved replacement body.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replaced',
      candidate,
      concurrency: { baseMainSha: freshMainSha },
      compileIssues: [],
    });
    if (result.kind !== 'replaced') return;
    expect(result.pullRequest.number).not.toBe(saved.pullRequest.number);
    expect(result.concurrency.draftHeadSha).toBeDefined();
    expect(result.concurrency.expectedBlobSha).toBeDefined();

    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, state: 'closed' }),
      expect.objectContaining({ number: result.pullRequest.number, state: 'open', draft: true }),
    ]);
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(result.concurrency.draftHeadSha);
    const committed = await adapter.getFileContent(branchName, path);
    expect(committed.ok && committed.value.content).toContain(candidate.body);
    const stalePublish = await adapter.updatePullRequest(saved.pullRequest.number, {
      draft: false,
    });
    expect(stalePublish).toMatchObject({
      ok: false,
      failure: { operation: 'update-pull-request', reason: 'validation' },
    });
  });

  it('authoritatively reuses the completed replacement on a repeated request', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'One deterministic replacement.' };
    const first = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    if (first.kind !== 'replaced') throw new Error(`replacement failed: ${first.kind}`);

    const repeated = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(repeated).toMatchObject({
      kind: 'replaced',
      candidate,
      pullRequest: { number: first.pullRequest.number },
      concurrency: first.concurrency,
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toHaveLength(1);
  });

  it('returns the exact failed phase for a transport timeout at every protocol boundary', async () => {
    const cases: Array<[StudioGithubOperation, string]> = [
      ['get-main-ref', 'discover-main'],
      ['get-branch', 'discover-branch'],
      ['get-file-content', 'verify-target'],
      ['list-article-files', 'verify-diff'],
      ['list-pull-requests', 'discover-pull-request'],
      ['close-pull-request', 'close-pull-request'],
      ['delete-branch', 'delete-branch'],
      ['create-branch', 'recreate-branch'],
      ['commit-file', 'commit-candidate'],
      ['create-pull-request', 'create-pull-request'],
    ];

    for (const [operation, phase] of cases) {
      const adapter = new FakeGithubAdapter(config);
      seedCanonical(adapter);
      const main = await adapter.getMainRef();
      if (!main.ok) throw new Error('main missing');
      const saved = await saveStudioDraft(
        adapter,
        slug,
        {
          metadata,
          body: 'Original draft body.',
          concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
        },
        { mediaBaseUrl },
      );
      if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
      adapter.advanceMain();
      adapter.setFailureOperation(operation);
      const candidate = { metadata, body: `Candidate survives ${operation}.` };

      const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
        mediaBaseUrl,
      });

      expect(result).toMatchObject({
        kind: 'replacement_failed',
        candidate,
        phase,
        reason: 'github',
      });
    }
  });

  it('fails closed on ambiguous and non-Draft pull-request topology before closing anything', async () => {
    for (const topology of ['multiple', 'ready'] as const) {
      const adapter = new FakeGithubAdapter(config);
      seedCanonical(adapter);
      const main = await adapter.getMainRef();
      if (!main.ok) throw new Error('main missing');
      const saved = await saveStudioDraft(
        adapter,
        slug,
        {
          metadata,
          body: 'Original draft body.',
          concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
        },
        { mediaBaseUrl },
      );
      if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
      if (topology === 'multiple') adapter.seedPullRequest(branchName, { draft: true });
      else {
        const ready = await adapter.updatePullRequest(saved.pullRequest.number, { draft: false });
        if (!ready.ok) throw new Error('could not mark ready');
      }
      adapter.advanceMain();
      const candidate = { metadata, body: `Blocked ${topology} topology.` };

      const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
        mediaBaseUrl,
      });

      expect(result).toMatchObject({
        kind: 'replacement_conflict',
        candidate,
        phase: 'discover-pull-request',
        reason: 'topology',
      });
      const pulls = await adapter.listPullRequests(branchName);
      expect(pulls.ok && pulls.value.every((pull) => pull.state === 'open')).toBe(true);
    }
  });

  it('rediscoveries through a stale PR read until closure is authoritative', async () => {
    const adapter = new EventuallyClosedAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    adapter.staleClosedReads = 1;
    const candidate = { metadata, body: 'Wait for authoritative closure.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({ kind: 'replaced', candidate });
  });

  it('lets Publish mark ready first, closes conservatively, and makes its later auto-merge fail', async () => {
    const adapter = new PublishRaceAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Recovery wins after ready.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({ kind: 'replaced', candidate });
    expect(adapter.autoMergeAfterClose).toMatchObject({
      ok: false,
      failure: { operation: 'enable-auto-merge', reason: 'validation' },
    });
  });

  it('never deletes a newer head when a concurrent Save commits before recovery deletion', async () => {
    const adapter = new SaveRaceAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    adapter.raceOnDelete = true;
    const candidate = { metadata, body: 'Recovery must not overwrite concurrent Save.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'delete-branch',
      reason: 'moved-head',
      evidence: { branch: { headSha: adapter.concurrentCommit?.commitSha } },
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(adapter.concurrentCommit?.commitSha);
    const committed = await adapter.getFileContent(branchName, path);
    expect(committed.ok && committed.value.content).toContain('Concurrent Save wins.');
  });

  it('preserves an invalid candidate and reports its committed compile issues', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: '# Unsupported heading survives' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replaced',
      candidate,
      compileIssues: [{ code: 'UNSUPPORTED_NODE' }],
    });
    const committed = await adapter.getFileContent(branchName, path);
    expect(committed.ok && committed.value.content).toContain(candidate.body);
  });

  it('blocks replacement when the target article changed on main and leaves the Draft untouched', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain({
      path,
      content: serializeArticleSource({ frontmatter, body: 'Changed canonical body.' }),
      blobSha: 'd'.repeat(40),
    });
    const candidate = { metadata, body: 'Do not overwrite the canonical change.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-target',
      reason: 'not-eligible',
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(saved.concurrency.draftHeadSha);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: saved.pullRequest.number, state: 'open', draft: true }),
    ]);
  });

  it('replaces a new-article Draft when the target stayed absent across main movement', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Original new article.', concurrency: { baseMainSha: main.value.sha } },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Replacement new article.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({ kind: 'replaced', candidate });
  });

  it('blocks a Draft whose branch changes more than the target article', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.seedFile(
      branchName,
      'content/articles/unrelated.md',
      serializeArticleSource({
        frontmatter: { ...frontmatter, slug: 'unrelated' },
        body: 'Extra.',
      }),
      'e'.repeat(40),
    );
    adapter.advanceMain();
    const candidate = { metadata, body: 'Do not replace a multi-file Draft.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-diff',
      reason: 'not-eligible',
    });
  });

  it('rechecks the old head diff before reconstructing a direct-UI close and delete', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.seedFile(
      branchName,
      'content/articles/direct-ui-extra.md',
      serializeArticleSource({
        frontmatter: { ...frontmatter, slug: 'direct-ui-extra' },
        body: 'Unexpected direct UI content.',
      }),
      'f'.repeat(40),
    );
    adapter.advanceMain();
    const closed = await adapter.closePullRequest(saved.pullRequest.number);
    if (!closed.ok) throw new Error('could not close prior pull');
    const deleted = await adapter.deleteBranch(
      branchName,
      saved.concurrency.draftHeadSha as string,
    );
    if (!deleted.ok) throw new Error('could not delete old branch');
    const candidate = { metadata, body: 'Do not reconstruct an unproven old diff.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-diff',
      reason: 'not-eligible',
    });
  });

  it('aborts reconstruction when the prior pull request was ready, not Draft, before a direct-UI close and delete', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const ready = await adapter.updatePullRequest(saved.pullRequest.number, { draft: false });
    if (!ready.ok) throw new Error('could not mark pull ready');
    const closed = await adapter.closePullRequest(saved.pullRequest.number);
    if (!closed.ok) throw new Error('could not close ready pull');
    const deleted = await adapter.deleteBranch(
      branchName,
      saved.concurrency.draftHeadSha as string,
    );
    if (!deleted.ok) throw new Error('could not delete old branch');
    const candidate = {
      metadata,
      body: 'Must not silently replace an approved-then-closed draft.',
    };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'confirm-pull-request',
      reason: 'topology',
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toEqual([]);
  });

  it('aborts explicitly when discovery shows the prior pull request already merged', async () => {
    const adapter = new MergedPullDiscoveryAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    adapter.reportMerged = true;
    const candidate = { metadata, body: 'Never overwrite a merged result.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'discover-pull-request',
      reason: 'merged',
      evidence: { pullRequest: { number: saved.pullRequest.number, state: 'merged' } },
    });
    const branch = await adapter.getBranch(branchName);
    expect(branch.ok && branch.value.sha).toBe(saved.concurrency.draftHeadSha);
  });

  it('reconstructs a closed prior Draft after its response is lost and resumes at deletion', async () => {
    const adapter = new LostCloseResponseAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Resume at old branch deletion.' };

    const interrupted = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(interrupted).toMatchObject({ kind: 'replacement_failed', phase: 'close-pull-request' });

    const resumed = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(resumed).toMatchObject({ kind: 'replaced', candidate });
  });

  it('reconstructs an exact committed candidate after its response is lost and resumes at Draft PR creation', async () => {
    const adapter = new LostCommitResponseAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Resume at Draft PR creation.' };

    const interrupted = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(interrupted).toMatchObject({ kind: 'replacement_failed', phase: 'commit-candidate' });

    const resumed = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(resumed).toMatchObject({ kind: 'replaced', candidate });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toHaveLength(1);
  });

  it('reconstructs a recreated branch after its response is lost and resumes at candidate commit', async () => {
    const adapter = new LostCreateBranchResponseAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Resume at candidate commit.' };

    const interrupted = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(interrupted).toMatchObject({ kind: 'replacement_failed', phase: 'recreate-branch' });

    const resumed = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(resumed).toMatchObject({ kind: 'replaced', candidate });
  });

  it('reconstructs a lost delete response after restart and resumes without duplicating writes', async () => {
    const adapter = new LostDeleteResponseAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Resume this exact candidate.' };

    const interrupted = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(interrupted).toMatchObject({
      kind: 'replacement_failed',
      candidate,
      phase: 'delete-branch',
    });

    const resumed = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });
    expect(resumed).toMatchObject({ kind: 'replaced', candidate });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toHaveLength(1);
  });

  it('re-reads main and the target blob before reporting the replacement complete', async () => {
    const adapter = new TargetMovesBeforeConfirmationAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Candidate remains recoverable after a late main move.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({
      kind: 'replacement_conflict',
      candidate,
      phase: 'confirm-replacement',
      reason: 'not-eligible',
      evidence: {
        mainSha: adapter.movedMainSha,
        target: { loadedBlobSha: 'b'.repeat(40), freshBlobSha: '9'.repeat(40) },
      },
    });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toHaveLength(1);
  });

  it('rediscovers and reuses the one Draft PR when its creation response is lost', async () => {
    const adapter = new LostCreatePullResponseAdapter(config);
    seedCanonical(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft body.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      { mediaBaseUrl },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);
    adapter.advanceMain();
    const candidate = { metadata, body: 'Preserved after a lost PR response.' };

    const result = await replaceStudioDraft(adapter, slug, candidate, saved.concurrency, {
      mediaBaseUrl,
    });

    expect(result).toMatchObject({ kind: 'replaced', candidate });
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value.filter((pull) => pull.state === 'open')).toHaveLength(1);
  });
});
