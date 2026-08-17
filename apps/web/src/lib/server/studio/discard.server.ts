import type { GithubAdapter, StudioPullRequest } from './github-adapter';

export type StudioDiscardResult =
  | {
      kind: 'discarded';
      pullRequest: { number: number; url: string };
    }
  | {
      kind: 'discard_conflict';
      expectedHeadSha: string;
      currentHeadSha: string | null;
    }
  | {
      kind: 'discard_failed';
      /** Names the failed operation phase so failures are always actionable. */
      phase: 'branch' | 'pull-request' | 'close-pull-request' | 'delete-branch';
      /**
       * 'topology' marks a GitHub-side state Discard cannot safely resolve
       * on its own (more than one open Draft PR, or no active Draft PR to close) rather
       * than a transient GitHub error.
       */
      reason: 'github' | 'topology';
    };

/**
 * Discard closes the article's sole open Draft PR and deletes only its
 * Studio branch — `main` is never touched. This includes a ready Draft PR whose
 * required check failed before auto-merge could fire. Everything is re-read
 * fresh from GitHub; nothing from a prior page load is trusted:
 *
 *  1. the branch must still exist at exactly `expectedHeadSha` (the head the
 *     operator saw when they confirmed) — a moved head is a
 *     `discard_conflict`, never a silent delete of different content;
 *  2. exactly one active Draft PR for the branch is discovered (head ref,
 *     base ref, and PR head must all agree with the branch) and closed;
 *  3. the branch is deleted only with the expected-head precondition — a
 *     head moved between that check and the DELETE itself is surfaced as a
 *     `discard_conflict` with the freshest observed head;
 *  4. a retry after a partial failure re-reads topology: an already-closed
 *     sole Draft PR matching this branch name, base, and the branch's current head
 *     (unrelated historical closed PRs are ignored) resumes with just the
 *     branch deletion — no duplicate close, no second PR, no new writes.
 */
export async function discardStudioDraft(
  adapter: GithubAdapter,
  slug: string,
  expectedHeadSha: string,
): Promise<StudioDiscardResult> {
  const branchName = `studio/article/${slug}`;

  const branch = await adapter.getBranch(branchName);
  if (!branch.ok) {
    if (branch.failure.reason === 'not-found') {
      return { kind: 'discard_conflict', expectedHeadSha, currentHeadSha: null };
    }
    return { kind: 'discard_failed', phase: 'branch', reason: 'github' };
  }
  if (branch.value.sha !== expectedHeadSha) {
    return { kind: 'discard_conflict', expectedHeadSha, currentHeadSha: branch.value.sha };
  }

  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return { kind: 'discard_failed', phase: 'pull-request', reason: 'github' };
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  const closedPulls = pulls.value.filter((pull) => pull.state === 'closed');

  let pull: StudioPullRequest | undefined;
  if (openPulls.length === 1) {
    const candidate = openPulls[0];
    if (
      candidate === undefined ||
      candidate.headRef !== branchName ||
      candidate.baseRef !== 'main' ||
      candidate.headSha !== branch.value.sha
    ) {
      return { kind: 'discard_failed', phase: 'pull-request', reason: 'topology' };
    }
    pull = candidate;
    const closed = await adapter.closePullRequest(candidate.number);
    if (!closed.ok) {
      return { kind: 'discard_failed', phase: 'close-pull-request', reason: 'github' };
    }
  } else if (openPulls.length > 1) {
    return { kind: 'discard_failed', phase: 'pull-request', reason: 'topology' };
  } else {
    // A prior Discard closed the PR but did not delete the branch; only the
    // branch deletion remains. The closed PR this Discard created is the
    // unique one matching this branch name, base, AND the branch's current
    // head — unrelated historical closed PRs for the same branch are
    // ignored. Zero or multiple matching candidates fail topology: recovery
    // must never guess which PR (or whether any) this Discard closed.
    const matchingClosedPulls = closedPulls.filter(
      (pull) =>
        pull.headRef === branchName && pull.baseRef === 'main' && pull.headSha === branch.value.sha,
    );
    if (matchingClosedPulls.length !== 1) {
      return { kind: 'discard_failed', phase: 'pull-request', reason: 'topology' };
    }
    const matchingPull = matchingClosedPulls[0];
    if (matchingPull === undefined) {
      return { kind: 'discard_failed', phase: 'pull-request', reason: 'topology' };
    }
    pull = matchingPull;
  }

  const deleted = await adapter.deleteBranch(branchName, branch.value.sha);
  if (!deleted.ok) {
    if (deleted.failure.reason === 'conflict') {
      // The branch moved between Discard's own fresh check and the deletion
      // (a race GitHub's DELETE cannot make atomic — see the adapter's
      // comment): surface the conflict with the freshest observed head
      // instead of a generic failure.
      const refreshed = await adapter.getBranch(branchName);
      return {
        kind: 'discard_conflict',
        expectedHeadSha: branch.value.sha,
        currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
      };
    }
    return {
      kind: 'discard_failed',
      phase: 'delete-branch',
      reason: deleted.failure.reason === 'topology' ? 'topology' : 'github',
    };
  }

  return { kind: 'discarded', pullRequest: { number: pull.number, url: pull.url } };
}
