import {
  createAppJwt,
  exchangeInstallationToken,
  type GithubAppAuthResult,
} from './github-adapter.auth';
import type { StudioGithubConfig } from './config.server';
import type {
  GithubAdapterResult,
  GithubReadAdapter,
  StudioBranch,
  StudioCheckRun,
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
export class GithubApiAdapter implements GithubReadAdapter {
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
    this.fetchImpl = options.fetch ?? globalThis.fetch;
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
