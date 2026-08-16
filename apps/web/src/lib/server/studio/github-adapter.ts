/**
 * GitHubAdapter — the single server-only seam between the Studio and GitHub.
 *
 * Every Studio route, lifecycle decision, and editor action reaches GitHub
 * exclusively through this interface; nothing else in the Studio touches the
 * GitHub API. Each method returns a bounded result: a validated value, or a
 * sanitized failure carrying a stable operation name and reason code — never
 * raw upstream bodies, credentials, or stack traces. Unexpected topology
 * (the wrong branch shape, more than one Draft PR for a branch, a moved
 * head, an attempt to touch `main`) fails closed so the Studio can never act
 * on an ambiguous view of GitHub.
 *
 * Tests drive the in-memory fake in `github-adapter.fake.ts`; the production
 * implementation wires the App JWT + installation-token exchange from
 * `github-adapter.auth.ts` and is activated at operator Checkpoint A. Studio
 * code is authored and tested with no GitHub connectivity at all.
 */

import type { StudioGithubConfig } from './config.server';

export type StudioGithubOperation =
  | 'get-branch'
  | 'list-branches'
  | 'get-main-ref'
  | 'create-branch'
  | 'commit-file'
  | 'get-file-content'
  | 'list-article-files'
  | 'list-pull-requests'
  | 'create-pull-request'
  | 'update-pull-request'
  | 'enable-auto-merge'
  | 'get-check-run'
  | 'close-pull-request'
  | 'delete-branch';

export type StudioGithubFailureReason =
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'rate-limit'
  | 'topology'
  | 'transport';

export interface StudioGithubFailure {
  operation: StudioGithubOperation;
  reason: StudioGithubFailureReason;
  /** HTTP status when the failure originated from an upstream response. */
  status?: number;
}

export type GithubAdapterResult<T> =
  { ok: true; value: T } | { ok: false; failure: StudioGithubFailure };

export interface StudioBranch {
  name: string;
  sha: string;
  url: string;
}

export interface StudioGitRef {
  name: string;
  sha: string;
  url: string;
}

export interface StudioFileContent {
  path: string;
  content: string;
  blobSha: string;
}

export interface StudioCommitFileResult {
  commitSha: string;
  commitUrl: string;
  blobSha: string;
}

export interface StudioPullRequest {
  number: number;
  url: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  draft: boolean;
  state: 'open' | 'closed' | 'merged';
  /** Present for merged PRs; used to correlate historical evidence. */
  mergeCommitSha?: string;
}

export interface StudioCheckRun {
  /** GitHub run identity when supplied by the production adapter. */
  id?: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;
  url?: string;
  completedAt?: string;
}

export interface CommitFileInput {
  branch: string;
  path: string;
  content: string;
  message: string;
  expectedHeadSha: string;
}

export interface CreatePullRequestInput {
  title: string;
  body: string;
  head: string;
  base: string;
  draft: true;
}

export interface GithubAdapter {
  /** Reads a single branch (`main` or a Studio branch) by name. */
  getBranch(name: string): Promise<GithubAdapterResult<StudioBranch>>;

  /**
   * Discovers Studio draft branches (`studio/article/*`) in deterministic
   * order. Bounded; an implausibly large result set fails closed.
   */
  listStudioBranches(): Promise<GithubAdapterResult<StudioBranch[]>>;

  /** Reads the `refs/heads/main` reference. */
  getMainRef(): Promise<GithubAdapterResult<StudioGitRef>>;

  /**
   * Creates a Studio branch from an observed existing object SHA (the `main`
   * SHA the caller read earlier). Unknown SHAs and duplicate names fail
   * closed; `main` itself can never be recreated.
   */
  createBranch(name: string, fromSha: string): Promise<GithubAdapterResult<StudioBranch>>;

  /**
   * Commits a single file to a Studio branch. The branch head must still
   * equal `expectedHeadSha`, or the commit fails with a conflict and nothing
   * changes. Committing to `main` is forbidden at the seam.
   */
  commitFile(input: CommitFileInput): Promise<GithubAdapterResult<StudioCommitFileResult>>;

  /** Reads one file from a branch name or immutable commit SHA. Content is bounded. */
  getFileContent(ref: string, path: string): Promise<GithubAdapterResult<StudioFileContent>>;

  /** Lists canonical article source files at a branch name or immutable commit SHA. */
  listArticleFiles(ref: string): Promise<GithubAdapterResult<StudioFileContent[]>>;

  /**
   * Lists pull requests whose head ref matches (any state, so a discarded
   * Draft PR stays discoverable until its branch is gone). Bounded.
   */
  listPullRequests(head: string): Promise<GithubAdapterResult<StudioPullRequest[]>>;

  /**
   * Creates a Draft PR for a branch. More than one open PR for the same head
   * is unexpected topology and fails closed.
   */
  createPullRequest(input: CreatePullRequestInput): Promise<GithubAdapterResult<StudioPullRequest>>;

  /** Updates an open PR — currently only the `draft` flag (Publish's readiness flip). */
  updatePullRequest(
    number: number,
    patch: { draft: boolean },
  ): Promise<GithubAdapterResult<StudioPullRequest>>;

  /**
   * Enables auto-merge for an open PR, but only while the PR head still
   * equals `expectedHeadSha`. A moved head fails closed: Publish must be
   * re-approved against the new committed draft.
   */
  enableAutoMerge(number: number, expectedHeadSha: string): Promise<GithubAdapterResult<void>>;

  /** Returns the latest check run with `name` on the PR head, or null. */
  getCheckRun(
    number: number,
    name: string,
    expectedHeadSha?: string,
  ): Promise<GithubAdapterResult<StudioCheckRun | null>>;

  /** Closes an open PR (Discard). */
  closePullRequest(number: number): Promise<GithubAdapterResult<void>>;

  /**
   * Deletes a Studio branch (Discard), verifying the branch head still
   * equals `expectedHeadSha` first. `main` can never be deleted.
   */
  deleteBranch(name: string, expectedHeadSha: string): Promise<GithubAdapterResult<void>>;
}

/** Read-only capability used by lifecycle and preview loads before Save exists. */
export type GithubReadAdapter = Pick<
  GithubAdapter,
  | 'getBranch'
  | 'listStudioBranches'
  | 'getMainRef'
  | 'getFileContent'
  | 'listArticleFiles'
  | 'listPullRequests'
  | 'getCheckRun'
>;

/**
 * Read capability plus the three write methods Save (#16) needs: branch
 * creation, a single-file commit with an expected-head precondition, and a
 * Draft PR. Publish (#17) and Discard (#18) add the remaining write methods
 * to a full `GithubAdapter`.
 */
export type GithubSaveAdapter = GithubReadAdapter &
  Pick<GithubAdapter, 'createBranch' | 'commitFile' | 'createPullRequest'>;

/**
 * Save capability plus the two write methods Publish (#17) needs: flipping
 * the Draft PR ready and enabling head-bound auto-merge. The production
 * adapter additionally implements Discard's remaining write methods
 * (`closePullRequest`, `deleteBranch`), completing the full `GithubAdapter`.
 */
export type GithubPublishAdapter = GithubSaveAdapter &
  Pick<GithubAdapter, 'updatePullRequest' | 'enableAutoMerge'>;

/** The repository context every adapter needs; production wires StudioGithubConfig. */
export type { StudioGithubConfig };
