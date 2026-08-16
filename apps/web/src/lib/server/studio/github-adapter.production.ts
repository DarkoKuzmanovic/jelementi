import {
  createAppJwt,
  exchangeInstallationToken,
  GITHUB_USER_AGENT,
  type GithubAppAuthResult,
} from './github-adapter.auth';
import type { StudioGithubConfig } from './config.server';
import type {
  CommitFileInput,
  CreatePullRequestInput,
  GithubAdapterResult,
  GithubPublishAdapter,
  StudioBranch,
  StudioCheckRun,
  StudioCommitFileResult,
  StudioFileContent,
  StudioGitRef,
  StudioGithubFailure,
  StudioGithubFailureReason,
  StudioGithubOperation,
  StudioPullRequest,
} from './github-adapter';

const DEFAULT_API_BASE_URL = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const MAX_RESPONSE_BYTES = 8_000_000;
const MAX_ARTICLE_BYTES = 2_000_000;
const MAX_LIST_ITEMS = 1_000;
const MAX_PULL_PAGES = 10;
const MAX_PULL_PAGE_SIZE = 100;
const MAX_BRANCH_PAGE_SIZE = 100;
const MAX_BRANCH_PAGES = 10;
const MAX_CHECK_PAGE_SIZE = 100;
const MAX_COMMIT_MESSAGE = 500;
const MAX_PULL_REQUEST_TITLE = 500;
const MAX_PULL_REQUEST_BODY = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_LEEWAY_MS = 30_000;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const ARTICLE_PATH_PATTERN = /^content\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const STUDIO_BRANCH_PATTERN = /^studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_PATTERN = /^(?:main|studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const CHECK_CONCLUSIONS = new Set([
  'success',
  'failure',
  'neutral',
  'cancelled',
  'skipped',
  'timed_out',
  'action_required',
]);
const GRAPHQL_PATH = '/graphql';
const MAX_NODE_ID_LENGTH = 200;
/**
 * M3 uses squash merge so one article PR becomes one resulting `main`
 * commit (docs/specs/2026-08-13-m3-publishing-studio-design.md).
 */
const AUTO_MERGE_METHOD = 'SQUASH';

type GithubInstallationToken = { token: string; expiresAt: string };
type Authenticate = () => Promise<GithubAppAuthResult<GithubInstallationToken>>;
type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string };

type ParsedPullRequest = StudioPullRequest;

type ApiResult<T> = GithubAdapterResult<T>;

export interface GithubApiAdapterOptions {
  /** Injectable transport for tests; production uses the Worker fetch. */
  fetch?: typeof globalThis.fetch;
  /** Injectable clock for token expiry tests. */
  now?: () => number;
  /** Override only for GitHub-compatible test servers. */
  apiBaseUrl?: string;
  /** Maximum time for each GitHub request, including response reading. */
  requestTimeoutMs?: number;
  /** Injectable App-auth boundary; production derives this from config. */
  authenticate?: Authenticate;
}

/**
 * Server-only GitHub App adapter. It owns the REST/GraphQL translation and
 * returns only bounded, validated Studio values. Runtime route activation is
 * deliberately separate: Checkpoint A supplies credentials and wiring.
 */
export class GithubApiAdapter implements GithubPublishAdapter {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly apiBaseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly authenticate: Authenticate;
  private cachedToken: { token: string; expiresAtMs: number } | undefined;

  constructor(
    private readonly config: StudioGithubConfig,
    options: GithubApiAdapterOptions = {},
  ) {
    // Bound explicitly: this field is invoked as `this.fetchImpl(...)`, and
    // workerd (like browsers) throws "Illegal invocation" when native fetch
    // is called with a foreign receiver such as this adapter instance.
    // Node's undici ignores the receiver, so only production surfaced it.
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    this.apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
    this.requestTimeoutMs =
      options.requestTimeoutMs !== undefined &&
      Number.isFinite(options.requestTimeoutMs) &&
      options.requestTimeoutMs > 0
        ? options.requestTimeoutMs
        : DEFAULT_REQUEST_TIMEOUT_MS;
    this.authenticate =
      options.authenticate ??
      (async () => {
        const jwt = await createAppJwt(config, { fetch: this.fetchImpl, now: this.now });
        if (!jwt.ok) return jwt;
        return exchangeInstallationToken(config, jwt.value, {
          fetch: this.fetchImpl,
          now: this.now,
          timeoutMs: this.requestTimeoutMs,
        });
      });
  }

  async getBranch(name: string): Promise<ApiResult<StudioBranch>> {
    if (!BRANCH_PATTERN.test(name)) return this.failure('get-branch', 'validation');
    const result = await this.requestJson('get-branch', this.refPath(name));
    if (!result.ok) return result;
    return parseBranch(result.value, name, this.repositoryTreeUrl(name), 'get-branch');
  }

  async listStudioBranches(): Promise<ApiResult<StudioBranch[]>> {
    const branches: StudioBranch[] = [];
    for (let page = 1; page <= MAX_BRANCH_PAGES; page += 1) {
      const query = new URLSearchParams({
        per_page: String(MAX_BRANCH_PAGE_SIZE),
        page: String(page),
      });
      const result = await this.requestJson(
        'list-branches',
        `/repos/${this.repositoryPath()}/branches?${query.toString()}`,
      );
      if (!result.ok) return result;
      if (!Array.isArray(result.value) || result.value.length > MAX_BRANCH_PAGE_SIZE) {
        return this.failure('list-branches', 'validation');
      }
      for (const entry of result.value) {
        if (!isRecord(entry) || typeof entry.name !== 'string') {
          return this.failure('list-branches', 'validation');
        }
        const name = entry.name;
        if (!name.startsWith('studio/article/')) continue;
        if (!STUDIO_BRANCH_PATTERN.test(name)) {
          return this.failure('list-branches', 'topology');
        }
        const sha = readSha(readRecord(entry.commit)?.sha);
        if (sha === undefined) return this.failure('list-branches', 'validation');
        branches.push({ name, sha, url: this.repositoryTreeUrl(name) });
      }
      if (branches.length > MAX_LIST_ITEMS) return this.failure('list-branches', 'validation');
      if (result.value.length < MAX_BRANCH_PAGE_SIZE) break;
      if (page === MAX_BRANCH_PAGES) return this.failure('list-branches', 'validation');
    }
    branches.sort((left, right) => left.name.localeCompare(right.name));
    return { ok: true, value: branches };
  }

  async getMainRef(): Promise<ApiResult<StudioGitRef>> {
    const result = await this.requestJson('get-main-ref', this.refPath('main'));
    if (!result.ok) return result;
    const parsed = parseRef(result.value, 'main', 'get-main-ref');
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      value: {
        name: 'refs/heads/main',
        sha: parsed.value.sha,
        url: this.repositoryTreeUrl('main'),
      },
    };
  }

  async createBranch(name: string, fromSha: string): Promise<ApiResult<StudioBranch>> {
    if (name === 'main') return this.failure('create-branch', 'forbidden');
    if (!STUDIO_BRANCH_PATTERN.test(name) || !SHA_PATTERN.test(fromSha)) {
      return this.failure('create-branch', 'validation');
    }
    const result = await this.requestJson(
      'create-branch',
      `/repos/${this.repositoryPath()}/git/refs`,
      { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }) },
    );
    if (!result.ok) return this.remapUnprocessableToConflict(result, 'create-branch');
    return parseBranch(result.value, name, this.repositoryTreeUrl(name), 'create-branch');
  }

  /**
   * Commits one file via the low-level Git Data API (blob -> tree -> commit
   * -> non-force ref update) so the branch head precondition is explicit: the
   * branch is read first and compared against `expectedHeadSha` before any
   * object is written, and the final ref update stays a fast-forward from
   * that exact parent, so a head that moved between the read and the write is
   * rejected as a conflict rather than silently overwritten.
   */
  async commitFile(input: CommitFileInput): Promise<ApiResult<StudioCommitFileResult>> {
    if (input.branch === 'main') return this.failure('commit-file', 'forbidden');
    if (
      !STUDIO_BRANCH_PATTERN.test(input.branch) ||
      !ARTICLE_PATH_PATTERN.test(input.path) ||
      input.content.length > MAX_ARTICLE_BYTES ||
      input.message.trim().length === 0 ||
      input.message.length > MAX_COMMIT_MESSAGE ||
      !SHA_PATTERN.test(input.expectedHeadSha)
    ) {
      return this.failure('commit-file', 'validation');
    }

    const ref = await this.requestJson('commit-file', this.refPath(input.branch));
    if (!ref.ok) return ref;
    const parsedRef = parseRef(ref.value, input.branch, 'commit-file');
    if (!parsedRef.ok) return parsedRef;
    if (parsedRef.value.sha !== input.expectedHeadSha) {
      return this.failure('commit-file', 'conflict');
    }

    const parentCommit = await this.requestJson(
      'commit-file',
      `/repos/${this.repositoryPath()}/git/commits/${input.expectedHeadSha}`,
    );
    if (!parentCommit.ok) return parentCommit;
    const baseTreeSha = readSha(readRecord(readRecord(parentCommit.value)?.tree)?.sha);
    if (baseTreeSha === undefined) return this.failure('commit-file', 'validation');

    const blob = await this.requestJson(
      'commit-file',
      `/repos/${this.repositoryPath()}/git/blobs`,
      { method: 'POST', body: JSON.stringify({ content: input.content, encoding: 'utf-8' }) },
    );
    if (!blob.ok) return blob;
    const blobSha = readSha(readRecord(blob.value)?.sha);
    if (blobSha === undefined) return this.failure('commit-file', 'validation');

    const tree = await this.requestJson(
      'commit-file',
      `/repos/${this.repositoryPath()}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: [{ path: input.path, mode: '100644', type: 'blob', sha: blobSha }],
        }),
      },
    );
    if (!tree.ok) return tree;
    const treeSha = readSha(readRecord(tree.value)?.sha);
    if (treeSha === undefined) return this.failure('commit-file', 'validation');

    const commit = await this.requestJson(
      'commit-file',
      `/repos/${this.repositoryPath()}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: input.message,
          tree: treeSha,
          parents: [input.expectedHeadSha],
        }),
      },
    );
    if (!commit.ok) return commit;
    const commitSha = readSha(readRecord(commit.value)?.sha);
    if (commitSha === undefined) return this.failure('commit-file', 'validation');

    const updatedRef = await this.requestJson('commit-file', this.refPath(input.branch), {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha, force: false }),
    });
    if (!updatedRef.ok) return this.remapUnprocessableToConflict(updatedRef, 'commit-file');

    return {
      ok: true,
      value: {
        commitSha,
        commitUrl: `https://github.com/${this.config.owner}/${this.config.repo}/commit/${commitSha}`,
        blobSha,
      },
    };
  }

  /**
   * Creates a Draft PR. Re-reads open pull requests for the head first so a
   * retry after an earlier successful create fails closed on unexpected
   * topology (an existing open PR) instead of racing GitHub's own duplicate
   * check or creating a second PR.
   */
  async createPullRequest(input: CreatePullRequestInput): Promise<ApiResult<StudioPullRequest>> {
    if (
      !STUDIO_BRANCH_PATTERN.test(input.head) ||
      input.base !== 'main' ||
      input.draft !== true ||
      input.title.trim().length === 0 ||
      input.title.length > MAX_PULL_REQUEST_TITLE ||
      input.body.length > MAX_PULL_REQUEST_BODY
    ) {
      return this.failure('create-pull-request', 'validation');
    }
    const existing = await this.listPullRequests(input.head);
    if (!existing.ok) return remapFailure(existing, 'create-pull-request');
    if (existing.value.some((pull) => pull.state === 'open')) {
      return this.failure('create-pull-request', 'topology');
    }

    const result = await this.requestJson(
      'create-pull-request',
      `/repos/${this.repositoryPath()}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
          draft: true,
        }),
      },
    );
    if (!result.ok) return result;
    const parsed = parsePullRequest(result.value, 'create-pull-request');
    if (!parsed.ok) return parsed;
    if (
      parsed.value.headRef !== input.head ||
      parsed.value.baseRef !== input.base ||
      !parsed.value.draft
    ) {
      return this.failure('create-pull-request', 'topology');
    }
    return parsed;
  }

  /**
   * Flips the Draft PR's readiness (Publish's revalidation step). GitHub's
   * REST `PATCH .../pulls/{number}` silently ignores a `draft` field, so
   * this is GraphQL-only: `markPullRequestReadyForReview` or
   * `convertPullRequestToDraft`, then an authoritative REST re-read so the
   * returned value reflects what GitHub actually recorded rather than the
   * mutation's own echo.
   */
  async updatePullRequest(
    number: number,
    patch: { draft: boolean },
  ): Promise<ApiResult<StudioPullRequest>> {
    if (!Number.isSafeInteger(number) || number < 1) {
      return this.failure('update-pull-request', 'validation');
    }
    const record = await this.getPullRequestRecord(number, 'update-pull-request');
    if (!record.ok) return record;
    if (record.value.pull.state !== 'open') {
      return this.failure('update-pull-request', 'validation');
    }
    if (record.value.pull.draft === patch.draft) return { ok: true, value: record.value.pull };
    const mutation = patch.draft
      ? `mutation($id: ID!) { convertPullRequestToDraft(input: { pullRequestId: $id }) { pullRequest { id } } }`
      : `mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { id } } }`;
    const mutated = await this.requestGraphQL('update-pull-request', mutation, {
      id: record.value.nodeId,
    });
    if (!mutated.ok) return mutated;
    const reread = await this.getPullRequest(number, 'update-pull-request');
    if (!reread.ok) return reread;
    if (reread.value.state !== 'open' || reread.value.draft !== patch.draft) {
      return this.failure('update-pull-request', 'topology');
    }
    return reread;
  }

  /**
   * Enables auto-merge for an open, non-draft PR — but only while its head
   * still equals `expectedHeadSha`, checked once against a fresh REST read
   * before the mutation and again by GitHub itself via `expectedHeadOid`
   * (ADR-0004: no branch mutation after Publish approval). GitHub's
   * auto-merge toggle is GraphQL-only; there is no REST equivalent.
   */
  async enableAutoMerge(number: number, expectedHeadSha: string): Promise<ApiResult<void>> {
    if (!Number.isSafeInteger(number) || number < 1 || !SHA_PATTERN.test(expectedHeadSha)) {
      return this.failure('enable-auto-merge', 'validation');
    }
    const record = await this.getPullRequestRecord(number, 'enable-auto-merge');
    if (!record.ok) return record;
    if (record.value.pull.state !== 'open' || record.value.pull.draft) {
      return this.failure('enable-auto-merge', 'validation');
    }
    if (record.value.pull.headSha !== expectedHeadSha) {
      return this.failure('enable-auto-merge', 'conflict');
    }
    const mutation = `mutation($input: EnablePullRequestAutoMergeInput!) { enablePullRequestAutoMerge(input: $input) { pullRequest { autoMergeRequest { enabledAt } } } }`;
    const result = await this.requestGraphQL('enable-auto-merge', mutation, {
      input: {
        pullRequestId: record.value.nodeId,
        expectedHeadOid: expectedHeadSha,
        mergeMethod: AUTO_MERGE_METHOD,
      },
    });
    if (!result.ok) return result;
    // The GraphQL envelope alone (`ok: true`) only proves the request was
    // well-formed, not that GitHub actually enabled auto-merge — validate
    // the mutation's own claimed result rather than trusting a bare 200.
    const payload = readRecord(result.value.enablePullRequestAutoMerge);
    const pull = payload === undefined ? undefined : readRecord(payload.pullRequest);
    const autoMergeRequest = pull === undefined ? undefined : readRecord(pull.autoMergeRequest);
    if (autoMergeRequest === undefined) {
      return this.failure('enable-auto-merge', 'validation');
    }
    return { ok: true, value: undefined };
  }

  /**
   * Closes an open PR (Discard) via REST `PATCH .../pulls/{number}`. Only an
   * open PR may be closed; the mutation's own response is validated to show
   * the closed state before success is reported — a bare 200 is never
   * trusted on its own.
   */
  async closePullRequest(number: number): Promise<ApiResult<void>> {
    if (!Number.isSafeInteger(number) || number < 1) {
      return this.failure('close-pull-request', 'validation');
    }
    const record = await this.getPullRequestRecord(number, 'close-pull-request');
    if (!record.ok) return record;
    if (record.value.pull.state !== 'open') {
      return this.failure('close-pull-request', 'validation');
    }
    const result = await this.requestJson(
      'close-pull-request',
      `/repos/${this.repositoryPath()}/pulls/${number}`,
      { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) },
    );
    if (!result.ok) return result;
    const parsed = parsePullRequest(result.value, 'close-pull-request');
    if (!parsed.ok) return parsed;
    if (parsed.value.state !== 'closed') {
      return this.failure('close-pull-request', 'topology');
    }
    return { ok: true, value: undefined };
  }

  /**
   * Deletes a Studio branch (Discard) via the Git refs API. The branch head
   * is read fresh and must still equal `expectedHeadSha` before the DELETE
   * is issued — a moved head fails closed as a conflict. GitHub's REST
   * `DELETE /git/refs/{ref}` has no expected-SHA/If-Match parameter, so this
   * immediate fresh GET → compare → DELETE sequence is the strongest
   * API-supported boundary (issue #18 requires only expected-head
   * verification before branch deletion); a 409 or 422 from the DELETE
   * itself is surfaced as a conflict rather than a generic failure. `main`
   * can never be deleted.
   */
  async deleteBranch(name: string, expectedHeadSha: string): Promise<ApiResult<void>> {
    if (name === 'main') return this.failure('delete-branch', 'forbidden');
    if (!STUDIO_BRANCH_PATTERN.test(name) || !SHA_PATTERN.test(expectedHeadSha)) {
      return this.failure('delete-branch', 'validation');
    }
    const ref = await this.requestJson('delete-branch', this.refPath(name));
    if (!ref.ok) return ref;
    const parsedRef = parseRef(ref.value, name, 'delete-branch');
    if (!parsedRef.ok) return parsedRef;
    if (parsedRef.value.sha !== expectedHeadSha) {
      return this.failure('delete-branch', 'conflict');
    }
    const deleted = await this.requestJson('delete-branch', this.refPath(name), {
      method: 'DELETE',
    });
    if (!deleted.ok) return this.remapUnprocessableToConflict(deleted, 'delete-branch');
    // GitHub answers 204 No Content; a body on success is unexpected.
    if (deleted.value !== undefined) return this.failure('delete-branch', 'validation');
    return { ok: true, value: undefined };
  }

  async getFileContent(ref: string, path: string): Promise<ApiResult<StudioFileContent>> {
    if (!isContentRef(ref) || !ARTICLE_PATH_PATTERN.test(path)) {
      return this.failure('get-file-content', 'validation');
    }
    const result = await this.requestJson(
      'get-file-content',
      `/repos/${this.repositoryPath()}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!result.ok) return result;
    const record = readRecord(result.value);
    if (record?.type !== 'file' || record.path !== path || record.encoding !== 'base64') {
      return this.failure('get-file-content', 'validation');
    }
    const blobSha = readSha(record.sha);
    if (blobSha === undefined || typeof record.content !== 'string') {
      return this.failure('get-file-content', 'validation');
    }
    const content = decodeBase64(record.content, MAX_ARTICLE_BYTES);
    if (content === undefined) return this.failure('get-file-content', 'validation');
    return { ok: true, value: { path, content, blobSha } };
  }

  async listArticleFiles(ref: string): Promise<ApiResult<StudioFileContent[]>> {
    if (!isContentRef(ref)) return this.failure('list-article-files', 'validation');
    const result = await this.requestJson(
      'list-article-files',
      `/repos/${this.repositoryPath()}/contents/content/articles?ref=${encodeURIComponent(ref)}`,
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.value) || result.value.length >= MAX_LIST_ITEMS) {
      return this.failure('list-article-files', 'validation');
    }
    const paths: string[] = [];
    for (const entry of result.value) {
      if (!isRecord(entry)) return this.failure('list-article-files', 'validation');
      if (entry.type === 'dir') continue;
      if (entry.type !== 'file') return this.failure('list-article-files', 'validation');
      if (typeof entry.path !== 'string') return this.failure('list-article-files', 'validation');
      if (entry.path.endsWith('.md') && !ARTICLE_PATH_PATTERN.test(entry.path)) {
        return this.failure('list-article-files', 'topology');
      }
      if (ARTICLE_PATH_PATTERN.test(entry.path)) paths.push(entry.path);
    }
    if (new Set(paths).size !== paths.length) return this.failure('list-article-files', 'topology');
    paths.sort((left, right) => left.localeCompare(right));

    const files: StudioFileContent[] = [];
    for (const path of paths) {
      const file = await this.getFileContent(ref, path);
      if (!file.ok) return remapFailure(file, 'list-article-files');
      files.push(file.value);
    }
    return { ok: true, value: files };
  }

  async listPullRequests(head: string): Promise<ApiResult<StudioPullRequest[]>> {
    if (!STUDIO_BRANCH_PATTERN.test(head)) return this.failure('list-pull-requests', 'validation');
    const pulls: StudioPullRequest[] = [];
    for (let page = 1; page <= MAX_PULL_PAGES; page += 1) {
      const query = new URLSearchParams({
        state: 'all',
        head: `${this.config.owner}:${head}`,
        base: 'main',
        per_page: String(MAX_PULL_PAGE_SIZE),
        page: String(page),
      });
      const result = await this.requestJson(
        'list-pull-requests',
        `/repos/${this.repositoryPath()}/pulls?${query.toString()}`,
      );
      if (!result.ok) return result;
      if (!Array.isArray(result.value) || result.value.length > MAX_PULL_PAGE_SIZE) {
        return this.failure('list-pull-requests', 'validation');
      }
      for (const value of result.value) {
        const parsed = parsePullRequest(value, 'list-pull-requests');
        if (!parsed.ok) return parsed;
        if (
          parsed.value.headRef !== head ||
          parsed.value.baseRef !== 'main' ||
          !pullHeadBelongsToRepository(value, this.repositoryFullName())
        ) {
          return this.failure('list-pull-requests', 'topology');
        }
        pulls.push(parsed.value);
      }
      if (pulls.length > MAX_LIST_ITEMS) return this.failure('list-pull-requests', 'validation');
      if (result.value.length < MAX_PULL_PAGE_SIZE) break;
      if (page === MAX_PULL_PAGES) return this.failure('list-pull-requests', 'validation');
    }
    pulls.sort((left, right) => left.number - right.number);
    return { ok: true, value: pulls };
  }

  async getCheckRun(
    number: number,
    name: string,
    expectedHeadSha?: string,
  ): Promise<ApiResult<StudioCheckRun | null>> {
    if (
      !Number.isSafeInteger(number) ||
      number < 1 ||
      name.trim().length === 0 ||
      name.length > 200
    ) {
      return this.failure('get-check-run', 'validation');
    }
    const pull = await this.getPullRequest(number, 'get-check-run');
    if (!pull.ok) return pull;
    if (expectedHeadSha !== undefined && pull.value.headSha !== expectedHeadSha) {
      return this.failure('get-check-run', 'conflict');
    }
    const query = new URLSearchParams({ check_name: name, per_page: String(MAX_CHECK_PAGE_SIZE) });
    const result = await this.requestJson(
      'get-check-run',
      `/repos/${this.repositoryPath()}/commits/${pull.value.headSha}/check-runs?${query.toString()}`,
    );
    if (!result.ok) return result;
    const record = readRecord(result.value);
    if (!Array.isArray(record?.check_runs) || record.check_runs.length >= MAX_CHECK_PAGE_SIZE) {
      return this.failure('get-check-run', 'validation');
    }
    const matching = record.check_runs.filter(
      (value): value is Record<string, unknown> => isRecord(value) && value.name === name,
    );
    if (matching.length === 0) return { ok: true, value: null };
    if (matching.length > 1) {
      const ids = matching.map((value) => value.id);
      if (ids.some((id) => typeof id !== 'number') || new Set(ids).size !== ids.length) {
        return this.failure('get-check-run', 'topology');
      }
      matching.sort((left, right) => Number(left.id) - Number(right.id));
    }
    const parsed = parseCheckRun(matching[matching.length - 1], 'get-check-run');
    if (!parsed.ok) return parsed;
    return { ok: true, value: parsed.value };
  }

  private async getPullRequest(
    number: number,
    operation: StudioGithubOperation,
  ): Promise<ApiResult<ParsedPullRequest>> {
    const result = await this.requestJson(
      operation,
      `/repos/${this.repositoryPath()}/pulls/${number}`,
    );
    if (!result.ok) return result;
    return parsePullRequest(result.value, operation);
  }

  /**
   * Reads a pull request and its GraphQL node id in one REST call. The node
   * id is only ever needed to address the PR through GraphQL mutations
   * (`updatePullRequest`, `enableAutoMerge`); every other read stays on the
   * numbered REST endpoint.
   */
  private async getPullRequestRecord(
    number: number,
    operation: StudioGithubOperation,
  ): Promise<ApiResult<{ pull: ParsedPullRequest; nodeId: string }>> {
    const result = await this.requestJson(
      operation,
      `/repos/${this.repositoryPath()}/pulls/${number}`,
    );
    if (!result.ok) return result;
    const pull = parsePullRequest(result.value, operation);
    if (!pull.ok) return pull;
    const nodeId = readRecord(result.value)?.node_id;
    if (typeof nodeId !== 'string' || nodeId.length === 0 || nodeId.length > MAX_NODE_ID_LENGTH) {
      return this.failure(operation, 'validation');
    }
    return { ok: true, value: { pull: pull.value, nodeId } };
  }

  /**
   * GitHub's GraphQL endpoint always answers 200 for a well-formed request,
   * reporting logical failures (not found, forbidden, an
   * `expectedHeadOid` mismatch) through a top-level `errors` array instead
   * of an HTTP status — so this stays a separate path from `requestJson`'s
   * REST status mapping rather than a generalization of it.
   */
  private async requestGraphQL(
    operation: StudioGithubOperation,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<ApiResult<Record<string, unknown>>> {
    const token = await this.getToken();
    if (!token.ok) return this.failure(operation, 'auth');
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token.value}`);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', API_VERSION);
    headers.set('User-Agent', GITHUB_USER_AGENT);
    headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${GRAPHQL_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return this.failure(
          operation,
          failureReasonForStatus(response.status, response.headers),
          response.status,
        );
      }
      const body = await readBoundedText(response, MAX_RESPONSE_BYTES);
      if (body === undefined) return this.failure(operation, 'validation');
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return this.failure(operation, 'validation');
      }
      const record = readRecord(parsed);
      if (record === undefined) return this.failure(operation, 'validation');
      if (Array.isArray(record.errors) && record.errors.length > 0) {
        return this.failure(operation, mapGraphQlErrors(record.errors));
      }
      const data = readRecord(record.data);
      if (data === undefined) return this.failure(operation, 'validation');
      return { ok: true, value: data };
    } catch {
      return this.failure(operation, 'transport');
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestJson(
    operation: StudioGithubOperation,
    path: string,
    init: JsonRequestInit = {},
  ): Promise<ApiResult<unknown>> {
    const token = await this.getToken();
    if (!token.ok) return this.failure(operation, 'auth');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token.value}`);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', API_VERSION);
    headers.set('User-Agent', GITHUB_USER_AGENT);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        return this.failure(
          operation,
          failureReasonForStatus(response.status, response.headers),
          response.status,
        );
      }
      if (response.status === 204) return { ok: true, value: undefined };
      const body = await readBoundedText(response, MAX_RESPONSE_BYTES);
      if (body === undefined) return this.failure(operation, 'validation');
      try {
        return { ok: true, value: JSON.parse(body) as unknown };
      } catch {
        return this.failure(operation, 'validation');
      }
    } catch {
      return this.failure(operation, 'transport');
    } finally {
      clearTimeout(timer);
    }
  }

  private async getToken(): Promise<ApiResult<string>> {
    const now = this.now();
    if (this.cachedToken !== undefined && this.cachedToken.expiresAtMs - now > TOKEN_LEEWAY_MS) {
      return { ok: true, value: this.cachedToken.token };
    }
    let result: GithubAppAuthResult<GithubInstallationToken>;
    try {
      result = await this.authenticate();
    } catch {
      return this.failure('get-main-ref', 'auth');
    }
    if (!result.ok) return this.failure('get-main-ref', 'auth');
    const expiresAtMs = Date.parse(result.value.expiresAt);
    if (
      result.value.token.length === 0 ||
      result.value.token.length > 4_096 ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= now
    ) {
      return this.failure('get-main-ref', 'auth');
    }
    this.cachedToken = { token: result.value.token, expiresAtMs };
    return { ok: true, value: result.value.token };
  }

  private repositoryPath(): string {
    return `${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}`;
  }

  private repositoryFullName(): string {
    return `${this.config.owner}/${this.config.repo}`;
  }

  private refPath(name: string): string {
    return `/repos/${this.repositoryPath()}/git/ref/heads/${encodePath(name)}`;
  }

  private repositoryTreeUrl(branch: string): string {
    return `https://github.com/${this.config.owner}/${this.config.repo}/tree/${branch}`;
  }

  private failure<T>(
    operation: StudioGithubOperation,
    reason: StudioGithubFailureReason,
    status?: number,
  ): ApiResult<T> {
    const failure: StudioGithubFailure = { operation, reason };
    if (status !== undefined) failure.status = status;
    return { ok: false, failure };
  }

  /**
   * GitHub reports both "reference already exists" (create-branch) and a
   * non-fast-forward ref update (commit-file's concurrency backstop) as 422.
   * Both are real conflicts, not malformed input, so this narrows the
   * generic status mapping for exactly those two write paths.
   */
  private remapUnprocessableToConflict<T>(
    result: ApiResult<T>,
    operation: StudioGithubOperation,
  ): ApiResult<T> {
    if (result.ok || result.failure.status !== 422) return result;
    return this.failure(operation, 'conflict', result.failure.status);
  }
}

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string | undefined> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new TextDecoder().decode(concatBytes(...chunks));
      if (value === undefined) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function parseRef(
  value: unknown,
  expectedName: string,
  operation: StudioGithubOperation,
): ApiResult<{ sha: string }> {
  const record = readRecord(value);
  const expectedRef = `refs/heads/${expectedName}`;
  if (record?.ref !== expectedRef) return { ok: false, failure: { operation, reason: 'topology' } };
  const sha = readSha(readRecord(record.object)?.sha);
  if (sha === undefined) return { ok: false, failure: { operation, reason: 'validation' } };
  return { ok: true, value: { sha } };
}

function parseBranch(
  value: unknown,
  expectedName: string,
  url: string,
  operation: StudioGithubOperation,
): ApiResult<StudioBranch> {
  const parsed = parseRef(value, expectedName, operation);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { name: expectedName, sha: parsed.value.sha, url } };
}

function parsePullRequest(
  value: unknown,
  operation: StudioGithubOperation,
): ApiResult<ParsedPullRequest> {
  const record = readRecord(value);
  const head = readRecord(record?.head);
  const base = readRecord(record?.base);
  const number = record?.number;
  const url = record?.html_url;
  const headRef = head?.ref;
  const headSha = readSha(head?.sha);
  const baseRef = base?.ref;
  const state = record?.state;
  const draft = record?.draft;
  const mergedAt = record?.merged_at;
  const mergeCommitSha = record?.merge_commit_sha;
  if (
    typeof number !== 'number' ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !isHttpUrl(url) ||
    typeof headRef !== 'string' ||
    headSha === undefined ||
    typeof baseRef !== 'string' ||
    (state !== 'open' && state !== 'closed') ||
    typeof draft !== 'boolean' ||
    (mergedAt !== null &&
      (typeof mergedAt !== 'string' || !Number.isFinite(Date.parse(mergedAt)))) ||
    (mergeCommitSha !== null &&
      mergeCommitSha !== undefined &&
      readSha(mergeCommitSha) === undefined)
  ) {
    return { ok: false, failure: { operation, reason: 'validation' } };
  }
  const mappedState: StudioPullRequest['state'] = typeof mergedAt === 'string' ? 'merged' : state;
  return {
    ok: true,
    value: {
      number,
      url,
      headRef,
      headSha,
      baseRef,
      draft,
      state: mappedState,
      ...(typeof mergeCommitSha === 'string' ? { mergeCommitSha } : {}),
    },
  };
}

function parseCheckRun(
  value: unknown,
  operation: StudioGithubOperation,
): ApiResult<StudioCheckRun> {
  const record = readRecord(value);
  const id = record?.id;
  const name = record?.name;
  const status = record?.status;
  const conclusion = record?.conclusion;
  const url = record?.html_url;
  const completedAt = record?.completed_at;
  const validConclusion =
    conclusion === null || (typeof conclusion === 'string' && CHECK_CONCLUSIONS.has(conclusion));
  if (
    (id !== undefined && (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1)) ||
    typeof name !== 'string' ||
    (status !== 'queued' && status !== 'in_progress' && status !== 'completed') ||
    !validConclusion ||
    (url !== undefined && !isHttpUrl(url)) ||
    (completedAt !== undefined &&
      completedAt !== null &&
      (typeof completedAt !== 'string' || !Number.isFinite(Date.parse(completedAt))))
  ) {
    return { ok: false, failure: { operation, reason: 'validation' } };
  }
  return {
    ok: true,
    value: {
      ...(typeof id === 'number' ? { id } : {}),
      name,
      status,
      conclusion: conclusion as StudioCheckRun['conclusion'],
      ...(typeof url === 'string' ? { url } : {}),
      ...(typeof completedAt === 'string' ? { completedAt } : {}),
    },
  };
}

function pullHeadBelongsToRepository(value: unknown, repositoryFullName: string): boolean {
  const repo = readRecord(readRecord(value)?.head)?.repo;
  return readRecord(repo)?.full_name === repositoryFullName;
}

function remapFailure<T>(result: ApiResult<T>, operation: StudioGithubOperation): ApiResult<T> {
  if (result.ok) return result;
  return { ok: false, failure: { ...result.failure, operation } };
}

function failureReasonForStatus(status: number, headers?: Headers): StudioGithubFailureReason {
  if (status === 401) return 'auth';
  if (status === 403 && headers?.get('x-ratelimit-remaining') === '0') return 'rate-limit';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'transport';
  return 'validation';
}

/**
 * GitHub's GraphQL errors carry a non-standard top-level `type` (e.g.
 * `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`); an `expectedHeadOid` mismatch
 * instead surfaces only as a message naming the head ref/oid, with no
 * dedicated type, so that case is matched on message content first.
 */
function mapGraphQlErrors(errors: unknown[]): StudioGithubFailureReason {
  for (const entry of errors) {
    const record = readRecord(entry);
    const type = typeof record?.type === 'string' ? record.type.toUpperCase() : undefined;
    const message = typeof record?.message === 'string' ? record.message.toLowerCase() : '';
    if (message.includes('head') && (message.includes('oid') || message.includes('ref'))) {
      return 'conflict';
    }
    if (type === 'NOT_FOUND') return 'not-found';
    if (type === 'FORBIDDEN') return 'forbidden';
    if (type === 'RATE_LIMITED') return 'rate-limit';
    if (type === 'UNPROCESSABLE') return 'conflict';
  }
  return 'validation';
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSha(value: unknown): string | undefined {
  return typeof value === 'string' && SHA_PATTERN.test(value) ? value : undefined;
}

function isContentRef(value: string): boolean {
  return BRANCH_PATTERN.test(value) || SHA_PATTERN.test(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function decodeBase64(value: string, maximumBytes: number): string | undefined {
  const normalized = value.replace(/\s/g, '');
  if (normalized.length === 0) return '';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return undefined;
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    return undefined;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.byteLength > maximumBytes) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
