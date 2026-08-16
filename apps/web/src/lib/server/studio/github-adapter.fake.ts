/**
 * In-memory fake GitHubAdapter for Studio tests.
 *
 * Mirrors the topology rules the production adapter must enforce — one
 * Draft PR per branch, expected-head preconditions on commit/branch-delete,
 * no `main` mutation — so lifecycle tests run with zero GitHub connectivity.
 * Not for production use.
 */

import type {
  CommitFileInput,
  CreatePullRequestInput,
  GithubAdapter,
  GithubAdapterResult,
  StudioBranch,
  StudioCheckRun,
  StudioCommitFileResult,
  StudioFileContent,
  StudioGitRef,
  StudioGithubFailureReason,
  StudioGithubOperation,
  StudioPullRequest,
} from './github-adapter';
import type { StudioGithubConfig } from './config.server';

const STUDIO_BRANCH_PATTERN = /^studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARTICLE_PATH_PATTERN = /^content\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const BRANCH_PATTERN = /^(?:main|studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const MAX_ARTICLE_BODY = 2_000_000;
const MAX_COMMIT_MESSAGE = 500;

function isContentRef(value: string): boolean {
  return BRANCH_PATTERN.test(value) || SHA_PATTERN.test(value);
}

export interface FakeGithubAdapterOptions {
  /** When true, every call fails with a transport failure (offline tests). */
  offline?: boolean;
  /** When true, every call fails with an auth failure (credential tests). */
  unauthorized?: boolean;
  /** Simulates GitHub rate limiting on all calls. */
  rateLimited?: boolean;
}

export class FakeGithubAdapter implements GithubAdapter {
  private readonly branches = new Map<string, StudioBranch>();
  private readonly refs = new Map<string, StudioGitRef>();
  private readonly files = new Map<string, Map<string, StudioFileContent>>();
  private readonly pulls = new Map<string, StudioPullRequest[]>();
  private readonly checks = new Map<string, StudioCheckRun[]>();
  private readonly nextPullNumber: () => number;
  private readonly repositoryUrl: string;
  private nextCommitSha = 1;
  private nextBlobSha = 0x100000;
  private options: FakeGithubAdapterOptions;

  constructor(config: StudioGithubConfig, options: FakeGithubAdapterOptions = {}) {
    this.options = options;
    this.repositoryUrl = `https://github.com/${config.owner}/${config.repo}`;
    let counter = 1000;
    this.nextPullNumber = () => {
      counter += 1;
      return counter;
    };
    const main = 'a'.repeat(40);
    this.refs.set('refs/heads/main', {
      name: 'refs/heads/main',
      sha: main,
      url: `${this.repositoryUrl}/refs/heads/main`,
    });
    this.branches.set('main', {
      name: 'main',
      sha: main,
      url: `${this.repositoryUrl}/branch/main`,
    });
    this.files.set('main', new Map());
  }

  private failure<T>(
    operation: StudioGithubOperation,
    reason: StudioGithubFailureReason,
  ): GithubAdapterResult<T> {
    return { ok: false, failure: { operation, reason } };
  }

  private guard<T>(operation: StudioGithubOperation): GithubAdapterResult<T> | undefined {
    if (this.options.offline) return this.failure<T>(operation, 'transport');
    if (this.options.unauthorized) return this.failure<T>(operation, 'auth');
    if (this.options.rateLimited) return this.failure<T>(operation, 'rate-limit');
    return undefined;
  }

  async getBranch(name: string): Promise<GithubAdapterResult<StudioBranch>> {
    const blocked = this.guard<StudioBranch>('get-branch');
    if (blocked !== undefined) return blocked;
    const branch = this.branches.get(name);
    return branch === undefined
      ? this.failure('get-branch', 'not-found')
      : { ok: true, value: { ...branch } };
  }

  async listStudioBranches(): Promise<GithubAdapterResult<StudioBranch[]>> {
    const blocked = this.guard<StudioBranch[]>('list-branches');
    if (blocked !== undefined) return blocked;
    const branches = [...this.branches.values()]
      .filter((branch) => STUDIO_BRANCH_PATTERN.test(branch.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((branch) => ({ ...branch }));
    return { ok: true, value: branches };
  }

  async getMainRef(): Promise<GithubAdapterResult<StudioGitRef>> {
    const blocked = this.guard<StudioGitRef>('get-main-ref');
    if (blocked !== undefined) return blocked;
    const ref = this.refs.get('refs/heads/main');
    return ref === undefined
      ? this.failure('get-main-ref', 'not-found')
      : { ok: true, value: { ...ref } };
  }

  async createBranch(name: string, fromSha: string): Promise<GithubAdapterResult<StudioBranch>> {
    const blocked = this.guard<StudioBranch>('create-branch');
    if (blocked !== undefined) return blocked;
    if (name === 'main') return this.failure('create-branch', 'forbidden');
    if (!STUDIO_BRANCH_PATTERN.test(name) || !SHA_PATTERN.test(fromSha)) {
      return this.failure('create-branch', 'validation');
    }
    if (this.branches.has(name)) return this.failure('create-branch', 'conflict');
    const parent = this.branches.get('main');
    if (parent === undefined || parent.sha !== fromSha) {
      return this.failure('create-branch', 'conflict');
    }
    const sha = fromSha;
    const branch: StudioBranch = {
      name,
      sha,
      url: `${this.repositoryUrl}/branch/${name}`,
    };
    this.branches.set(name, branch);
    this.files.set(name, new Map(this.files.get('main') ?? []));
    return { ok: true, value: { ...branch } };
  }

  async commitFile(input: CommitFileInput): Promise<GithubAdapterResult<StudioCommitFileResult>> {
    const blocked = this.guard<StudioCommitFileResult>('commit-file');
    if (blocked !== undefined) return blocked;
    const branch = this.branches.get(input.branch);
    if (branch === undefined) return this.failure('commit-file', 'not-found');
    if (input.branch === 'main') return this.failure('commit-file', 'forbidden');
    if (
      !STUDIO_BRANCH_PATTERN.test(input.branch) ||
      !ARTICLE_PATH_PATTERN.test(input.path) ||
      input.content.length > MAX_ARTICLE_BODY ||
      input.message.trim().length === 0 ||
      input.message.length > MAX_COMMIT_MESSAGE ||
      !SHA_PATTERN.test(input.expectedHeadSha)
    ) {
      return this.failure('commit-file', 'validation');
    }
    if (branch.sha !== input.expectedHeadSha) return this.failure('commit-file', 'conflict');
    const sha = this.nextCommitSha.toString(16).padStart(40, '0');
    this.nextCommitSha += 1;
    const blobSha = this.nextBlobSha.toString(16).padStart(40, '0');
    this.nextBlobSha += 1;
    branch.sha = sha;
    branch.url = `${this.repositoryUrl}/branch/${input.branch}/commit/${sha}`;
    const files = this.files.get(input.branch) ?? new Map();
    files.set(input.path, { path: input.path, content: input.content, blobSha });
    this.files.set(input.branch, files);
    for (const pull of this.pulls.get(input.branch) ?? []) {
      if (pull.state === 'open') pull.headSha = sha;
    }
    return {
      ok: true,
      value: {
        commitSha: sha,
        commitUrl: `${this.repositoryUrl}/commit/${sha}`,
        blobSha,
      },
    };
  }

  async getFileContent(ref: string, path: string): Promise<GithubAdapterResult<StudioFileContent>> {
    const blocked = this.guard<StudioFileContent>('get-file-content');
    if (blocked !== undefined) return blocked;
    if (!isContentRef(ref) || !ARTICLE_PATH_PATTERN.test(path)) {
      return this.failure('get-file-content', 'validation');
    }
    const resolvedRef = this.resolveFileRef(ref);
    const files = resolvedRef === undefined ? undefined : this.files.get(resolvedRef);
    const file = files?.get(path);
    if (file === undefined) return this.failure('get-file-content', 'not-found');
    if (file.content.length > MAX_ARTICLE_BODY) {
      return this.failure('get-file-content', 'validation');
    }
    return { ok: true, value: { ...file } };
  }

  async listArticleFiles(ref: string): Promise<GithubAdapterResult<StudioFileContent[]>> {
    const blocked = this.guard<StudioFileContent[]>('list-article-files');
    if (blocked !== undefined) return blocked;
    if (!isContentRef(ref)) return this.failure('list-article-files', 'validation');
    const resolvedRef = this.resolveFileRef(ref);
    if (resolvedRef === undefined) return this.failure('list-article-files', 'not-found');
    const files = [...(this.files.get(resolvedRef)?.values() ?? [])]
      .filter((file) => ARTICLE_PATH_PATTERN.test(file.path))
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      ok: true,
      value: files.map((file) => ({ ...file })),
    };
  }

  async listPullRequests(head: string): Promise<GithubAdapterResult<StudioPullRequest[]>> {
    const blocked = this.guard<StudioPullRequest[]>('list-pull-requests');
    if (blocked !== undefined) return blocked;
    const pulls = (this.pulls.get(head) ?? [])
      .slice()
      .sort((left, right) => left.number - right.number)
      .map((pull) => ({ ...pull }));
    return { ok: true, value: pulls };
  }

  async createPullRequest(
    input: CreatePullRequestInput,
  ): Promise<GithubAdapterResult<StudioPullRequest>> {
    const blocked = this.guard<StudioPullRequest>('create-pull-request');
    if (blocked !== undefined) return blocked;
    if (
      !STUDIO_BRANCH_PATTERN.test(input.head) ||
      input.base !== 'main' ||
      input.draft !== true ||
      !this.branches.has(input.head) ||
      input.title.trim().length === 0 ||
      input.body.length > MAX_ARTICLE_BODY
    ) {
      return this.failure('create-pull-request', 'validation');
    }
    const existing = this.pulls.get(input.head) ?? [];
    if (existing.some((pull) => pull.state === 'open')) {
      return this.failure('create-pull-request', 'topology');
    }
    const number = this.nextPullNumber();
    const pull: StudioPullRequest = {
      number,
      url: `${this.repositoryUrl}/pull/${number}`,
      headRef: input.head,
      headSha: this.branches.get(input.head)?.sha ?? '',
      baseRef: input.base,
      draft: input.draft,
      state: 'open',
    };
    this.pulls.set(input.head, [...existing, pull]);
    return { ok: true, value: { ...pull } };
  }

  async updatePullRequest(
    number: number,
    patch: { draft: boolean },
  ): Promise<GithubAdapterResult<StudioPullRequest>> {
    const blocked = this.guard<StudioPullRequest>('update-pull-request');
    if (blocked !== undefined) return blocked;
    const pull = this.findPull(number);
    if (pull === undefined) return this.failure('update-pull-request', 'not-found');
    if (pull.state !== 'open') return this.failure('update-pull-request', 'validation');
    pull.draft = patch.draft;
    return { ok: true, value: { ...pull } };
  }

  async enableAutoMerge(
    number: number,
    expectedHeadSha: string,
  ): Promise<GithubAdapterResult<void>> {
    const blocked = this.guard<void>('enable-auto-merge');
    if (blocked !== undefined) return blocked;
    const pull = this.findPull(number);
    if (pull === undefined) return this.failure('enable-auto-merge', 'not-found');
    if (pull.state !== 'open' || pull.draft) {
      return this.failure('enable-auto-merge', 'validation');
    }
    if (!SHA_PATTERN.test(expectedHeadSha)) return this.failure('enable-auto-merge', 'validation');
    if (pull.headSha !== expectedHeadSha) return this.failure('enable-auto-merge', 'conflict');
    return { ok: true, value: undefined };
  }

  async getCheckRun(
    number: number,
    name: string,
    expectedHeadSha?: string,
  ): Promise<GithubAdapterResult<StudioCheckRun | null>> {
    const blocked = this.guard<StudioCheckRun | null>('get-check-run');
    if (blocked !== undefined) return blocked;
    const pull = this.findPull(number);
    if (pull === undefined) return this.failure('get-check-run', 'not-found');
    if (expectedHeadSha !== undefined && pull.headSha !== expectedHeadSha) {
      return this.failure('get-check-run', 'conflict');
    }
    const runs = this.checks.get(pull.headSha) ?? [];
    const matchingRuns = runs.filter((check) => check.name === name);
    const run = matchingRuns[matchingRuns.length - 1];
    return { ok: true, value: run === undefined ? null : { ...run } };
  }

  async closePullRequest(number: number): Promise<GithubAdapterResult<void>> {
    const blocked = this.guard<void>('close-pull-request');
    if (blocked !== undefined) return blocked;
    const pull = this.findPull(number);
    if (pull === undefined) return this.failure('close-pull-request', 'not-found');
    if (pull.state !== 'open') return this.failure('close-pull-request', 'validation');
    pull.state = 'closed';
    return { ok: true, value: undefined };
  }

  async deleteBranch(name: string, expectedHeadSha: string): Promise<GithubAdapterResult<void>> {
    const blocked = this.guard<void>('delete-branch');
    if (blocked !== undefined) return blocked;
    if (name === 'main') return this.failure('delete-branch', 'forbidden');
    const branch = this.branches.get(name);
    if (branch === undefined) return this.failure('delete-branch', 'not-found');
    if (branch.sha !== expectedHeadSha) return this.failure('delete-branch', 'conflict');
    this.branches.delete(name);
    this.files.delete(name);
    return { ok: true, value: undefined };
  }

  /** Test helpers (not part of the seam). */
  seedBranch(name: string, sha: string): void {
    this.branches.set(name, { name, sha, url: `${this.repositoryUrl}/branch/${name}` });
    this.files.set(name, new Map());
  }

  seedFile(branch: string, path: string, content: string, blobSha: string): void {
    if (
      !ARTICLE_PATH_PATTERN.test(path) ||
      content.length > MAX_ARTICLE_BODY ||
      !SHA_PATTERN.test(blobSha)
    ) {
      throw new Error('invalid-seed-file');
    }
    const files = this.files.get(branch) ?? new Map();
    files.set(path, { path, content, blobSha });
    this.files.set(branch, files);
  }

  /**
   * Seeds a pull request directly for topology tests (ambiguous/multiple
   * open PRs, a non-draft open PR) without exercising createPullRequest's
   * own invariants.
   */
  seedPullRequest(head: string, overrides: Partial<StudioPullRequest> = {}): StudioPullRequest {
    const number = overrides.number ?? this.nextPullNumber();
    const pull: StudioPullRequest = {
      number,
      url: overrides.url ?? `${this.repositoryUrl}/pull/${number}`,
      headRef: overrides.headRef ?? head,
      headSha: overrides.headSha ?? this.branches.get(head)?.sha ?? '',
      baseRef: overrides.baseRef ?? 'main',
      draft: overrides.draft ?? true,
      state: overrides.state ?? 'open',
      ...(overrides.mergeCommitSha === undefined ? {} : { mergeCommitSha: overrides.mergeCommitSha }),
    };
    const existing = this.pulls.get(head) ?? [];
    this.pulls.set(head, [...existing, pull]);
    return { ...pull };
  }

  seedCheckRun(pullNumber: number, run: StudioCheckRun): void {
    const pull = this.findPull(pullNumber);
    if (pull === undefined) throw new Error(`no pull ${pullNumber}`);
    const runs = this.checks.get(pull.headSha) ?? [];
    runs.push(run);
    this.checks.set(pull.headSha, runs);
  }

  private resolveFileRef(ref: string): string | undefined {
    if (this.files.has(ref)) return ref;
    return [...this.branches.values()].find((branch) => branch.sha === ref)?.name;
  }

  private findPull(number: number): StudioPullRequest | undefined {
    for (const pulls of this.pulls.values()) {
      const pull = pulls.find((candidate) => candidate.number === number);
      if (pull !== undefined) return pull;
    }
    return undefined;
  }
}
