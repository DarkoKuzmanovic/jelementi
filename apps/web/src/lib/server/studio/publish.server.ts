import { compileArticle, ContentCompileError } from '@jelementi/content-compiler';
import type { StudioCompileIssue } from '../../studio/contracts';
import type { GithubPublishAdapter, StudioPullRequest } from './github-adapter';

export interface StudioPublishOptions {
  mediaBaseUrl: string;
}

export type StudioPublishResult =
  | {
      kind: 'published';
      pullRequest: { number: number; url: string };
      headSha: string;
    }
  | {
      kind: 'publish_conflict';
      /** The head the operator approved when they submitted Publish. */
      expectedHeadSha: string;
      /** The branch's current head, or `null` when the branch is gone entirely. */
      currentHeadSha: string | null;
    }
  | { kind: 'publish_rejected'; compileIssues: StudioCompileIssue[] }
  | {
      kind: 'publish_failed';
      /** Names the failed operation phase so failures are always actionable. */
      phase: 'branch' | 'revalidate' | 'pull-request' | 'ready' | 'auto-merge';
      /**
       * 'topology' marks a GitHub-side state Publish cannot safely resolve on
       * its own (more than one open PR for the branch, or none at all)
       * rather than a transient GitHub error.
       */
      reason: 'github' | 'topology';
    };

/**
 * Publish's explicit, head-bound approval (ADR-0004). Every step re-reads
 * GitHub fresh — nothing from a prior page load is trusted:
 *
 *  1. the Studio branch head must still equal `expectedHeadSha` exactly (a
 *     content change after the operator loaded the page is a
 *     `publish_conflict`, not a silent no-op or an approval of different
 *     content);
 *  2. the exact committed blob at that head is re-parsed and recompiled —
 *     the same validity gate Preview uses, but blocking here (`publish_rejected`)
 *     rather than merely reported, since Publish is the point nothing
 *     unpublishable may proceed past;
 *  3. the branch's sole open PR is flipped from Draft to ready
 *     (`updatePullRequest`);
 *  4. auto-merge is enabled for that PR, bound to `expectedHeadSha`
 *     (`enableAutoMerge`) — GitHub itself rejects a head that moved between
 *     steps 1 and 4, surfaced here as the same `publish_conflict`.
 *
 * Once auto-merge is enabled, Studio performs no further branch mutation:
 * a content change requires a new Save producing a new head, which needs a
 * new Publish (no rebase, no re-approval of a moved head).
 */
export async function publishStudioDraft(
  adapter: GithubPublishAdapter,
  slug: string,
  expectedHeadSha: string,
  options: StudioPublishOptions,
): Promise<StudioPublishResult> {
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;

  const branch = await adapter.getBranch(branchName);
  if (!branch.ok) {
    if (branch.failure.reason === 'not-found') {
      return { kind: 'publish_conflict', expectedHeadSha, currentHeadSha: null };
    }
    return { kind: 'publish_failed', phase: 'branch', reason: 'github' };
  }
  if (branch.value.sha !== expectedHeadSha) {
    return { kind: 'publish_conflict', expectedHeadSha, currentHeadSha: branch.value.sha };
  }

  const file = await adapter.getFileContent(expectedHeadSha, path);
  if (!file.ok) {
    if (file.failure.reason === 'not-found') {
      return { kind: 'publish_conflict', expectedHeadSha, currentHeadSha: branch.value.sha };
    }
    return { kind: 'publish_failed', phase: 'revalidate', reason: 'github' };
  }
  try {
    compileArticle({
      markdown: file.value.content,
      sourcePath: path,
      mediaBaseUrl: options.mediaBaseUrl,
    });
  } catch (cause) {
    if (cause instanceof ContentCompileError) {
      return { kind: 'publish_rejected', compileIssues: cause.issues };
    }
    return {
      kind: 'publish_rejected',
      compileIssues: [
        {
          code: 'COMPILER_FAILURE',
          message: 'The article could not be compiled.',
          sourcePath: path,
        },
      ],
    };
  }

  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return { kind: 'publish_failed', phase: 'pull-request', reason: 'github' };
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  const pull: StudioPullRequest | undefined = openPulls[0];
  if (openPulls.length !== 1 || pull === undefined) {
    return { kind: 'publish_failed', phase: 'pull-request', reason: 'topology' };
  }
  if (pull.headSha !== expectedHeadSha) {
    return { kind: 'publish_conflict', expectedHeadSha, currentHeadSha: pull.headSha };
  }

  const ready = await adapter.updatePullRequest(pull.number, { draft: false });
  if (!ready.ok) return { kind: 'publish_failed', phase: 'ready', reason: 'github' };

  const autoMerge = await adapter.enableAutoMerge(pull.number, expectedHeadSha);
  if (!autoMerge.ok) {
    if (autoMerge.failure.reason === 'conflict') {
      // Re-read so the reported current head is accurate rather than
      // inferred from a stale local value.
      const refreshed = await adapter.getBranch(branchName);
      return {
        kind: 'publish_conflict',
        expectedHeadSha,
        currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
      };
    }
    return { kind: 'publish_failed', phase: 'auto-merge', reason: 'github' };
  }

  return {
    kind: 'published',
    pullRequest: { number: ready.value.number, url: ready.value.url },
    headSha: expectedHeadSha,
  };
}
