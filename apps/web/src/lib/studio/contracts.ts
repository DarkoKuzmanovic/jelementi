import { ArticleDocumentSchema, type ArticleDocument } from '@jelementi/article-model';

/**
 * Studio request/result boundary contracts.
 *
 * Every decoder in this module is a zero-dependency, never-throwing runtime
 * validator except one deliberate delegation: the `preview_ok` document is
 * validated through the owning `ArticleDocumentSchema` from
 * `@jelementi/article-model` so a malformed document can never decode as a
 * successful preview. Untrusted Studio requests and server results decode into a
 * bounded internal value or an explicit sanitized rejection. Rejections carry
 * only stable reason codes — never input content, credentials, upstream
 * bodies, or stack traces. No decoder descends into unknown keys, so cyclic
 * input is rejected without recursing.
 *
 * Semantic article validation remains owned by `@jelementi/content-compiler`
 * and `@jelementi/article-model`; this module bounds the wire
 * envelope so no future repository or production side effect can run on
 * malformed input.
 */

export const STUDIO_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type StudioArticleStatus = (typeof STUDIO_ARTICLE_STATUSES)[number];

export const STUDIO_STATUS_KINDS = [
  'draft_invalid',
  'draft_valid',
  'ready',
  'checking',
  'check_failed',
  'merged',
  'pending_deployment',
  'live',
  'unpublish_pending',
  'archived',
  'conflict',
  'failed',
  'unknown',
] as const;
export type StudioStatusKind = (typeof STUDIO_STATUS_KINDS)[number];

export const STUDIO_FAILURE_CATEGORIES = [
  'auth',
  'config',
  'validation',
  'conflict',
  'github',
  'deploy',
  'probe',
  'timeout',
  'unknown',
] as const;
export type StudioFailureCategory = (typeof STUDIO_FAILURE_CATEGORIES)[number];

const MAX_URL = 2_048;
const MAX_BODY = 2_000_000;
const MAX_LIST = 100;
const SHA40 = /^[0-9a-f]{40}$/i;
const SHA64 = /^[0-9a-f]{64}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_PATTERN = /^studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Accepted date grammar without anchors: "YYYY-MM-DD" plus an optional full
 * ISO timestamp (#110). The Studio editor markup consumes this exact source
 * as its `pattern` attribute so the browser can never client-block a value
 * the decoder would accept (native date inputs would reject timestamps).
 */
export const STUDIO_ISO_DATE_PATTERN = String.raw`\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2}))?`;
const ISO_DATE_PATTERN = new RegExp(`^${STUDIO_ISO_DATE_PATTERN}$`);
/**
 * Authoritative editor-input length bounds (#110), defined once here beside
 * the decoders that enforce them; the editor markup consumes the same
 * values as `maxlength` so the browser and server can never drift.
 */
export const EDITOR_INPUT_LIMITS = {
  titleMax: 500,
  slugMax: 100,
  excerptMax: 2_000,
  categoryMax: 200,
  authorMax: 200,
  tagMax: 200,
  mediaKeyMax: 500,
  altMax: 2_000,
  urlMax: MAX_URL,
  referenceTitleMax: 500,
  referencePublisherMax: 500,
  bodyMax: MAX_BODY,
} as const;
const HTTPS_PATTERN = /^https:\/\//i;
const SAFE_KEY = /^[A-Za-z0-9._-]{1,32}$/;

export interface DecodeSuccess<T> {
  ok: true;
  value: T;
}
export interface DecodeFailure {
  ok: false;
  issues: string[];
}
export type DecodeResult<T> = DecodeSuccess<T> | DecodeFailure;

export interface StudioCompileIssue {
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  column?: number;
}

export interface StudioArticleRef {
  slug: string;
  title: string;
  status: StudioArticleStatus;
  updatedAt: string;
  url?: string;
}

export interface StudioBranchRef {
  name: string;
  url: string;
  headSha: string;
}

export interface StudioPullRequestRef {
  number: number;
  url: string;
  headSha: string;
}

export const STUDIO_PRODUCTION_STATES = [
  'absent',
  'live',
  'pending_deployment',
  'pending_removal',
] as const;
export type StudioProductionState = (typeof STUDIO_PRODUCTION_STATES)[number];

export const STUDIO_CHANGE_STATES = [
  'none',
  'draft',
  'ready',
  'checking',
  'check_failed',
  'merged',
] as const;
export type StudioChangeState = (typeof STUDIO_CHANGE_STATES)[number];

export const STUDIO_DRAFT_VALIDITIES = ['valid', 'invalid', 'unavailable'] as const;
export type StudioDraftValidity = (typeof STUDIO_DRAFT_VALIDITIES)[number];

export interface StudioArticleListFailureEvidence {
  phase: 'branch' | 'pull-request' | 'check' | 'compile';
  reason: 'github' | 'topology' | 'validation';
}

export interface StudioCheckEvidence {
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
}

/**
 * Read-only projection of GitHub-derived state for one canonical article or
 * one active new-article draft (a studio branch whose slug has not merged to
 * `main` yet, #39).
 */
export interface StudioArticleListEntry {
  slug: string;
  title: string;
  /** Canonical status on `main`; absent for a new-article draft. */
  canonicalStatus?: StudioArticleStatus;
  /** Frontmatter `updatedAt`; absent when a new draft has no parseable committed file. */
  updatedAt?: string;
  production: StudioProductionState;
  change: StudioChangeState;
  /** Immutable `main` observation used as bounded Flowboard concurrency evidence. */
  mainSha: string;
  /** Present whenever an active Studio branch exists. */
  draftValidity?: StudioDraftValidity;
  /** Bounded compiler issues for an invalid committed draft. */
  compileIssues?: StudioCompileIssue[];
  /** Article-local observation failure; the complete list remains available. */
  failure?: StudioArticleListFailureEvidence;
  publicUrl?: string;
  branch?: StudioBranchRef;
  pullRequest?: StudioPullRequestRef;
  check?: StudioCheckEvidence;
  branchPreviewUrl?: string;
  buildUrl?: string;
}

export interface StudioConcurrencyEvidence {
  baseMainSha: string;
  draftHeadSha?: string;
  expectedBlobSha?: string;
}

export interface StudioFailedCheck {
  name: string;
  url?: string;
}

export interface StudioIndexEvidence {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  categorySlug: string;
  tags: string[];
  author: string;
  cover: { src: string; alt: string };
  readingTimeMinutes: number;
}

export interface StudioReference {
  title: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
}

export interface StudioMetadata {
  title: string;
  slug: string;
  excerpt: string;
  status: StudioArticleStatus;
  publishedAt?: string;
  updatedAt: string;
  category: string;
  tags: string[];
  author: string;
  cover: { src: string; alt: string };
  audio?: { src: string; durationSeconds?: number };
  references: StudioReference[];
}

export interface StudioEditorInput {
  metadata: StudioMetadata;
  body: string;
  concurrency: StudioConcurrencyEvidence;
}

/**
 * The production-axis evidence that proves an already-published article is
 * Live, carried alongside the change-axis `draft_invalid`/`draft_valid`
 * kinds: per the two-axis lifecycle model, Live persists while an edit
 * draft exists — a draft in flight must never erase whether the currently
 * published version is proven live in production. Present only when a
 * Refresh (`includeProbe: true`) has actually proven Live; its absence
 * means "not proven live right now", never a claim that it is not live.
 */
export interface StudioLiveEvidence {
  mainSha: string;
  contentVersion: string;
  expected: StudioIndexEvidence;
  observed: StudioIndexEvidence;
}

export type StudioLifecycle =
  | {
      kind: 'draft_invalid';
      article: StudioArticleRef;
      branch: StudioBranchRef;
      issues: StudioCompileIssue[];
      productionLive?: StudioLiveEvidence;
    }
  | {
      kind: 'draft_valid';
      article: StudioArticleRef;
      branch: StudioBranchRef;
      productionLive?: StudioLiveEvidence;
    }
  | { kind: 'ready'; article: StudioArticleRef; pullRequest: StudioPullRequestRef }
  | { kind: 'checking'; article: StudioArticleRef; pullRequest: StudioPullRequestRef }
  | {
      kind: 'check_failed';
      article: StudioArticleRef;
      pullRequest: StudioPullRequestRef;
      failedCheck: StudioFailedCheck;
    }
  | { kind: 'merged'; article: StudioArticleRef; mainSha: string }
  | { kind: 'pending_deployment'; article: StudioArticleRef; mainSha: string }
  | {
      kind: 'live';
      article: StudioArticleRef;
      mainSha: string;
      contentVersion: string;
      expected: StudioIndexEvidence;
      observed: StudioIndexEvidence;
    }
  | { kind: 'unpublish_pending'; article: StudioArticleRef; mainSha: string }
  | { kind: 'archived'; article: StudioArticleRef; mainSha: string }
  | {
      kind: 'conflict';
      article: StudioArticleRef;
      loaded: StudioConcurrencyEvidence;
      current: StudioConcurrencyEvidence;
    }
  | {
      kind: 'failed';
      article: StudioArticleRef;
      phase: string;
      failure: { category: StudioFailureCategory; url?: string };
    }
  | { kind: 'unknown'; article: StudioArticleRef };

export type StudioPreviewResult =
  | { kind: 'preview_ok'; document: ArticleDocument; compileIssues: [] }
  | { kind: 'preview_issues'; compileIssues: StudioCompileIssue[] };

export type StudioResponse = StudioLifecycle | StudioPreviewResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function okResult<T>(value: T): DecodeResult<T> {
  return { ok: true, value };
}

function errResult(issues: string[]): DecodeFailure {
  return { ok: false, issues };
}

function collectIssues(path: string, issues: string[], ...codes: string[]): void {
  for (const code of codes) issues.push(`${path}.${code}`);
}

/** Reject unknown keys without echoing attacker-controlled key names verbatim. */
function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    collectIssues(path, issues, SAFE_KEY.test(key) ? `unknownKey.${key}` : 'unknownKey');
  }
}

function stringIssue(
  value: unknown,
  path: string,
  issues: string[],
  options?: { max?: number; allowEmpty?: boolean },
): void {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return;
  }
  if (options?.allowEmpty !== true && value.trim().length === 0) {
    collectIssues(path, issues, 'empty');
    return;
  }
  if (options?.max !== undefined && value.length > options.max) {
    collectIssues(path, issues, 'max');
  }
}

function shaValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return undefined;
  }
  if (!SHA40.test(value) && !SHA64.test(value)) {
    collectIssues(path, issues, 'sha');
    return undefined;
  }
  return value.toLowerCase();
}

function optionalShaValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  return shaValue(value, path, issues);
}

function slugValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return undefined;
  }
  if (
    value.length === 0 ||
    value.length > EDITOR_INPUT_LIMITS.slugMax ||
    !SLUG_PATTERN.test(value)
  ) {
    collectIssues(path, issues, 'slug');
    return undefined;
  }
  return value;
}

function isoDateValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return undefined;
  }
  if (value.length === 0 || value.length > 40 || !ISO_DATE_PATTERN.test(value)) {
    collectIssues(path, issues, 'date');
    return undefined;
  }
  // Calendar sanity mirroring the model's IsoDateSchema: reject impossible dates.
  const datePart = value.slice(0, 10);
  const parsed = new Date(datePart);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) {
    collectIssues(path, issues, 'date');
    return undefined;
  }
  return value;
}

function httpsUrlValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return undefined;
  }
  if (
    value.length === 0 ||
    value.length > MAX_URL ||
    !HTTPS_PATTERN.test(value) ||
    /\s/.test(value)
  ) {
    collectIssues(path, issues, 'url');
    return undefined;
  }
  return value;
}

function optionalHttpsUrlValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  return httpsUrlValue(value, path, issues);
}

function mediaKeyValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string') {
    collectIssues(path, issues, 'string');
    return undefined;
  }
  if (
    value.length === 0 ||
    value.length > EDITOR_INPUT_LIMITS.mediaKeyMax ||
    value.includes('\\') ||
    value.includes('%') ||
    /\s/.test(value) ||
    value.startsWith('/') ||
    value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    collectIssues(path, issues, 'mediaKey');
    return undefined;
  }
  return value;
}

function intAtLeastOne(value: unknown, path: string, issues: string[]): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    collectIssues(path, issues, 'integer');
    return undefined;
  }
  return value;
}

function compileIssueValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioCompileIssue | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['code', 'message', 'sourcePath', 'line', 'column'], path, issues);
  if (issues.length > 0) return undefined;
  stringIssue(input.code, `${path}.code`, issues, { max: 100 });
  stringIssue(input.message, `${path}.message`, issues, { max: 2_000 });
  stringIssue(input.sourcePath, `${path}.sourcePath`, issues, { max: 500 });
  if (issues.length > 0) return undefined;
  const line =
    input.line === undefined ? undefined : intAtLeastOne(input.line, `${path}.line`, issues);
  const column =
    input.column === undefined ? undefined : intAtLeastOne(input.column, `${path}.column`, issues);
  if (issues.length > 0) return undefined;
  return {
    code: input.code as string,
    message: input.message as string,
    sourcePath: input.sourcePath as string,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  };
}

function compileIssuesValue(
  input: unknown,
  path: string,
  issues: string[],
  requireNonEmpty: boolean,
): StudioCompileIssue[] | undefined {
  if (!Array.isArray(input)) {
    collectIssues(path, issues, 'array');
    return undefined;
  }
  if (requireNonEmpty && input.length === 0) {
    collectIssues(path, issues, 'nonEmpty');
    return undefined;
  }
  if (input.length > MAX_LIST) {
    collectIssues(path, issues, 'max');
    return undefined;
  }
  const result: StudioCompileIssue[] = [];
  for (const [index, item] of input.entries()) {
    const value = compileIssueValue(item, `${path}[${index}]`, issues);
    if (value === undefined) return undefined;
    result.push(value);
  }
  return result;
}

function articleRefValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioArticleRef | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['slug', 'title', 'status', 'updatedAt', 'url'], path, issues);
  if (issues.length > 0) return undefined;
  const slug = slugValue(input.slug, `${path}.slug`, issues);
  stringIssue(input.title, `${path}.title`, issues, { max: 500 });
  const status = input.status;
  if (
    typeof status !== 'string' ||
    !(STUDIO_ARTICLE_STATUSES as readonly string[]).includes(status)
  ) {
    collectIssues(path, issues, 'status');
  }
  const updatedAt = isoDateValue(input.updatedAt, `${path}.updatedAt`, issues);
  const url = optionalHttpsUrlValue(input.url, `${path}.url`, issues);
  if (issues.length > 0 || slug === undefined || updatedAt === undefined) return undefined;
  return {
    slug,
    title: input.title as string,
    status: status as StudioArticleStatus,
    updatedAt,
    ...(url === undefined ? {} : { url }),
  };
}

function branchRefValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioBranchRef | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['name', 'url', 'headSha'], path, issues);
  if (issues.length > 0) return undefined;
  const name = input.name;
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > 200 ||
    !BRANCH_PATTERN.test(name)
  ) {
    collectIssues(path, issues, 'branchName');
  }
  const url = httpsUrlValue(input.url, `${path}.url`, issues);
  const headSha = shaValue(input.headSha, `${path}.headSha`, issues);
  if (issues.length > 0 || headSha === undefined || url === undefined) return undefined;
  return { name: name as string, url, headSha };
}

function pullRequestValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioPullRequestRef | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['number', 'url', 'headSha'], path, issues);
  if (issues.length > 0) return undefined;
  const number = intAtLeastOne(input.number, `${path}.number`, issues);
  const url = httpsUrlValue(input.url, `${path}.url`, issues);
  const headSha = shaValue(input.headSha, `${path}.headSha`, issues);
  if (issues.length > 0 || number === undefined || url === undefined || headSha === undefined)
    return undefined;
  return { number, url, headSha };
}

function failedCheckValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioFailedCheck | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['name', 'url'], path, issues);
  if (issues.length > 0) return undefined;
  stringIssue(input.name, `${path}.name`, issues, { max: 200 });
  const url = optionalHttpsUrlValue(input.url, `${path}.url`, issues);
  if (issues.length > 0) return undefined;
  return { name: input.name as string, ...(url === undefined ? {} : { url }) };
}

function failureValue(
  input: unknown,
  path: string,
  issues: string[],
): { category: StudioFailureCategory; url?: string } | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['category', 'url'], path, issues);
  if (issues.length > 0) return undefined;
  const category = input.category;
  if (
    typeof category !== 'string' ||
    !(STUDIO_FAILURE_CATEGORIES as readonly string[]).includes(category)
  ) {
    collectIssues(path, issues, 'category');
  }
  const url = optionalHttpsUrlValue(input.url, `${path}.url`, issues);
  if (issues.length > 0) return undefined;
  return { category: category as StudioFailureCategory, ...(url === undefined ? {} : { url }) };
}

export function decodeConcurrencyEvidence(input: unknown): DecodeResult<StudioConcurrencyEvidence> {
  const issues: string[] = [];
  const value = concurrencyEvidenceValue(input, 'evidence', issues);
  if (issues.length > 0 || value === undefined) return errResult(issues);
  return okResult(value);
}

function concurrencyEvidenceValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioConcurrencyEvidence | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['baseMainSha', 'draftHeadSha', 'expectedBlobSha'], path, issues);
  if (issues.length > 0) return undefined;
  const baseMainSha = shaValue(input.baseMainSha, `${path}.baseMainSha`, issues);
  const draftHeadSha = optionalShaValue(input.draftHeadSha, `${path}.draftHeadSha`, issues);
  const expectedBlobSha = optionalShaValue(
    input.expectedBlobSha,
    `${path}.expectedBlobSha`,
    issues,
  );
  if (issues.length > 0 || baseMainSha === undefined) return undefined;
  return {
    baseMainSha,
    ...(draftHeadSha === undefined ? {} : { draftHeadSha }),
    ...(expectedBlobSha === undefined ? {} : { expectedBlobSha }),
  };
}

function evidenceEquals(
  left: StudioConcurrencyEvidence,
  right: StudioConcurrencyEvidence,
): boolean {
  return (
    left.baseMainSha === right.baseMainSha &&
    (left.draftHeadSha ?? null) === (right.draftHeadSha ?? null) &&
    (left.expectedBlobSha ?? null) === (right.expectedBlobSha ?? null)
  );
}

function indexEvidenceValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioIndexEvidence | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(
    input,
    [
      'slug',
      'title',
      'excerpt',
      'publishedAt',
      'updatedAt',
      'category',
      'categorySlug',
      'tags',
      'author',
      'cover',
      'readingTimeMinutes',
    ],
    path,
    issues,
  );
  if (issues.length > 0) return undefined;
  const slug = slugValue(input.slug, `${path}.slug`, issues);
  stringIssue(input.title, `${path}.title`, issues, { max: 500 });
  stringIssue(input.excerpt, `${path}.excerpt`, issues, { max: 2_000 });
  const publishedAt = isoDateValue(input.publishedAt, `${path}.publishedAt`, issues);
  const updatedAt = isoDateValue(input.updatedAt, `${path}.updatedAt`, issues);
  stringIssue(input.category, `${path}.category`, issues, { max: 200 });
  const categorySlug = slugValue(input.categorySlug, `${path}.categorySlug`, issues);
  stringIssue(input.author, `${path}.author`, issues, { max: 200 });
  const readingTimeMinutes = intAtLeastOne(
    input.readingTimeMinutes,
    `${path}.readingTimeMinutes`,
    issues,
  );
  if (!Array.isArray(input.tags) || input.tags.length > MAX_LIST) {
    collectIssues(path, issues, 'tags');
  } else {
    for (const [index, tag] of input.tags.entries()) {
      stringIssue(tag, `${path}.tags[${index}]`, issues, { max: 200 });
    }
  }
  if (!isRecord(input.cover)) {
    collectIssues(path, issues, 'cover');
  } else {
    rejectUnknownKeys(input.cover, ['src', 'alt'], `${path}.cover`, issues);
    if (issues.length > 0) return undefined;
    httpsUrlValue(input.cover.src, `${path}.cover.src`, issues);
    stringIssue(input.cover.alt, `${path}.cover.alt`, issues, { max: 2_000 });
  }
  if (
    issues.length > 0 ||
    slug === undefined ||
    publishedAt === undefined ||
    updatedAt === undefined ||
    categorySlug === undefined ||
    readingTimeMinutes === undefined
  ) {
    return undefined;
  }
  const cover = input.cover as Record<string, unknown>;
  return {
    slug,
    title: input.title as string,
    excerpt: input.excerpt as string,
    publishedAt,
    updatedAt,
    category: input.category as string,
    categorySlug,
    tags: input.tags as string[],
    author: input.author as string,
    cover: { src: cover.src as string, alt: cover.alt as string },
    readingTimeMinutes,
  };
}

/**
 * Exact comparison across every public index field; tags compare in order.
 *
 * Exported for reuse by the Studio status derivation (deriveStudioArticleStatus,
 * #17): the same expected-vs-observed reconciliation the `live` decoder
 * enforces on untrusted input applies to server-derived probe evidence.
 */
export function indexEvidenceEquals(
  left: StudioIndexEvidence,
  right: StudioIndexEvidence,
): boolean {
  return (
    left.slug === right.slug &&
    left.title === right.title &&
    left.excerpt === right.excerpt &&
    left.publishedAt === right.publishedAt &&
    left.updatedAt === right.updatedAt &&
    left.category === right.category &&
    left.categorySlug === right.categorySlug &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index]) &&
    left.author === right.author &&
    left.cover.src === right.cover.src &&
    left.cover.alt === right.cover.alt &&
    left.readingTimeMinutes === right.readingTimeMinutes
  );
}

/**
 * Decodes the optional `productionLive` evidence attached to `draft_invalid`
 * / `draft_valid`. Absent input is valid (undefined, "not proven live");
 * present input must be a fully-formed, internally-consistent live proof,
 * mirroring the `live` kind's own field validation.
 */
function optionalLiveEvidenceValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioLiveEvidence | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['mainSha', 'contentVersion', 'expected', 'observed'], path, issues);
  if (issues.length > 0) return undefined;
  const mainSha = shaValue(input.mainSha, `${path}.mainSha`, issues);
  const contentVersion = shaValue(input.contentVersion, `${path}.contentVersion`, issues);
  if (contentVersion !== undefined && !SHA64.test(contentVersion)) {
    collectIssues(`${path}.contentVersion`, issues, 'contentVersion');
  }
  const expected = indexEvidenceValue(input.expected, `${path}.expected`, issues);
  const observed = indexEvidenceValue(input.observed, `${path}.observed`, issues);
  if (
    expected !== undefined &&
    observed !== undefined &&
    !indexEvidenceEquals(expected, observed)
  ) {
    collectIssues(path, issues, 'evidenceMismatch');
  }
  if (
    issues.length > 0 ||
    mainSha === undefined ||
    contentVersion === undefined ||
    expected === undefined ||
    observed === undefined
  ) {
    return undefined;
  }
  return { mainSha, contentVersion, expected, observed };
}

function metadataValue(input: unknown, path: string, issues: string[]): StudioMetadata | undefined {
  if (!isRecord(input)) {
    collectIssues(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(
    input,
    [
      'title',
      'slug',
      'excerpt',
      'status',
      'publishedAt',
      'updatedAt',
      'category',
      'tags',
      'author',
      'cover',
      'audio',
      'references',
    ],
    path,
    issues,
  );
  if (issues.length > 0) return undefined;
  stringIssue(input.title, `${path}.title`, issues, { max: EDITOR_INPUT_LIMITS.titleMax });
  const slug = slugValue(input.slug, `${path}.slug`, issues);
  stringIssue(input.excerpt, `${path}.excerpt`, issues, { max: EDITOR_INPUT_LIMITS.excerptMax });
  const status = input.status;
  if (
    typeof status !== 'string' ||
    !(STUDIO_ARTICLE_STATUSES as readonly string[]).includes(status)
  ) {
    collectIssues(path, issues, 'status');
  }
  const publishedAt =
    input.publishedAt === undefined
      ? undefined
      : isoDateValue(input.publishedAt, `${path}.publishedAt`, issues);
  const updatedAt = isoDateValue(input.updatedAt, `${path}.updatedAt`, issues);
  stringIssue(input.category, `${path}.category`, issues, { max: EDITOR_INPUT_LIMITS.categoryMax });
  stringIssue(input.author, `${path}.author`, issues, { max: EDITOR_INPUT_LIMITS.authorMax });
  if (!Array.isArray(input.tags) || input.tags.length > MAX_LIST) {
    collectIssues(path, issues, 'tags');
  } else {
    for (const [index, tag] of input.tags.entries()) {
      stringIssue(tag, `${path}.tags[${index}]`, issues, { max: EDITOR_INPUT_LIMITS.tagMax });
    }
  }
  if (!isRecord(input.cover)) {
    collectIssues(path, issues, 'cover');
  } else {
    rejectUnknownKeys(input.cover, ['src', 'alt'], `${path}.cover`, issues);
    if (issues.length > 0) return undefined;
    mediaKeyValue(input.cover.src, `${path}.cover.src`, issues);
    stringIssue(input.cover.alt, `${path}.cover.alt`, issues, { max: EDITOR_INPUT_LIMITS.altMax });
  }
  if (input.audio !== undefined) {
    if (!isRecord(input.audio)) {
      collectIssues(path, issues, 'audio');
    } else {
      rejectUnknownKeys(input.audio, ['src', 'durationSeconds'], `${path}.audio`, issues);
      if (issues.length > 0) return undefined;
      mediaKeyValue(input.audio.src, `${path}.audio.src`, issues);
      if (input.audio.durationSeconds !== undefined) {
        intAtLeastOne(input.audio.durationSeconds, `${path}.audio.durationSeconds`, issues);
      }
    }
  }
  if (!Array.isArray(input.references) || input.references.length > MAX_LIST) {
    collectIssues(path, issues, 'references');
  } else {
    for (const [index, reference] of input.references.entries()) {
      if (!isRecord(reference)) {
        collectIssues(path, issues, 'reference');
        continue;
      }
      rejectUnknownKeys(
        reference,
        ['title', 'url', 'publisher', 'accessedAt'],
        `${path}.references[${index}]`,
        issues,
      );
      if (issues.length > 0) return undefined;
      stringIssue(reference.title, `${path}.references[${index}].title`, issues, {
        max: EDITOR_INPUT_LIMITS.referenceTitleMax,
      });
      httpsUrlValue(reference.url, `${path}.references[${index}].url`, issues);
      if (reference.publisher !== undefined) {
        stringIssue(reference.publisher, `${path}.references[${index}].publisher`, issues, {
          max: EDITOR_INPUT_LIMITS.referencePublisherMax,
        });
      }
      if (reference.accessedAt !== undefined) {
        isoDateValue(reference.accessedAt, `${path}.references[${index}].accessedAt`, issues);
      }
      if (issues.length > 0) return undefined;
    }
  }
  if (issues.length > 0 || slug === undefined || updatedAt === undefined) return undefined;
  const cover = input.cover as Record<string, unknown>;
  const audioRecord = input.audio as Record<string, unknown> | undefined;
  return {
    title: input.title as string,
    slug,
    excerpt: input.excerpt as string,
    status: status as StudioArticleStatus,
    ...(publishedAt === undefined ? {} : { publishedAt }),
    updatedAt,
    category: input.category as string,
    tags: input.tags as string[],
    author: input.author as string,
    cover: { src: cover.src as string, alt: cover.alt as string },
    ...(audioRecord === undefined
      ? {}
      : {
          audio: {
            src: audioRecord.src as string,
            ...(audioRecord.durationSeconds === undefined
              ? {}
              : { durationSeconds: audioRecord.durationSeconds as number }),
          },
        }),
    references: (input.references as Array<Record<string, unknown>>).map((reference) => ({
      title: reference.title as string,
      url: reference.url as string,
      ...(reference.publisher === undefined ? {} : { publisher: reference.publisher as string }),
      ...(reference.accessedAt === undefined ? {} : { accessedAt: reference.accessedAt as string }),
    })),
  };
}

export function decodeStudioEditorInput(input: unknown): DecodeResult<StudioEditorInput> {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return errResult(['input.object']);
  }
  rejectUnknownKeys(input, ['metadata', 'body', 'concurrency'], 'input', issues);
  if (issues.length > 0) return errResult(issues);
  const metadata = metadataValue(input.metadata, 'input.metadata', issues);
  if (typeof input.body !== 'string' || input.body.length > MAX_BODY) {
    collectIssues('input.body', issues, typeof input.body !== 'string' ? 'string' : 'max');
  }
  const concurrency = concurrencyEvidenceValue(input.concurrency, 'input.concurrency', issues);
  if (issues.length > 0 || metadata === undefined || concurrency === undefined)
    return errResult(issues);
  return okResult({ metadata, body: input.body as string, concurrency });
}

export function decodeStudioLifecycle(input: unknown): DecodeResult<StudioLifecycle> {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return errResult(['lifecycle.object']);
  }
  const kind = input.kind;
  if (typeof kind !== 'string' || !(STUDIO_STATUS_KINDS as readonly string[]).includes(kind)) {
    return errResult(['lifecycle.kind']);
  }
  const allowedByKind: Readonly<Record<string, readonly string[]>> = {
    draft_invalid: ['kind', 'article', 'branch', 'issues', 'productionLive'],
    draft_valid: ['kind', 'article', 'branch', 'productionLive'],
    ready: ['kind', 'article', 'pullRequest'],
    checking: ['kind', 'article', 'pullRequest'],
    check_failed: ['kind', 'article', 'pullRequest', 'failedCheck'],
    merged: ['kind', 'article', 'mainSha'],
    pending_deployment: ['kind', 'article', 'mainSha'],
    live: ['kind', 'article', 'mainSha', 'contentVersion', 'expected', 'observed'],
    unpublish_pending: ['kind', 'article', 'mainSha'],
    archived: ['kind', 'article', 'mainSha'],
    conflict: ['kind', 'article', 'loaded', 'current'],
    failed: ['kind', 'article', 'phase', 'failure'],
    unknown: ['kind', 'article'],
  };
  const allowed = allowedByKind[kind];
  if (allowed === undefined) return errResult(['lifecycle.kind']);
  rejectUnknownKeys(input, allowed, 'lifecycle', issues);
  if (issues.length > 0) return errResult(issues);
  const article = articleRefValue(input.article, 'lifecycle.article', issues);
  if (issues.length > 0 || article === undefined) return errResult(issues);

  switch (kind as StudioStatusKind) {
    case 'draft_invalid': {
      const branch = branchRefValue(input.branch, 'lifecycle.branch', issues);
      const issuesList = compileIssuesValue(input.issues, 'lifecycle.issues', issues, true);
      const productionLive = optionalLiveEvidenceValue(
        input.productionLive,
        'lifecycle.productionLive',
        issues,
      );
      if (issues.length > 0 || branch === undefined || issuesList === undefined)
        return errResult(issues);
      return okResult({
        kind: 'draft_invalid',
        article,
        branch,
        issues: issuesList,
        ...(productionLive === undefined ? {} : { productionLive }),
      });
    }
    case 'draft_valid': {
      const branch = branchRefValue(input.branch, 'lifecycle.branch', issues);
      const productionLive = optionalLiveEvidenceValue(
        input.productionLive,
        'lifecycle.productionLive',
        issues,
      );
      if (issues.length > 0 || branch === undefined) return errResult(issues);
      return okResult({
        kind: 'draft_valid',
        article,
        branch,
        ...(productionLive === undefined ? {} : { productionLive }),
      });
    }
    case 'ready':
    case 'checking': {
      const pullRequest = pullRequestValue(input.pullRequest, 'lifecycle.pullRequest', issues);
      if (issues.length > 0 || pullRequest === undefined) return errResult(issues);
      const lifecycleKind = kind as 'ready' | 'checking';
      return okResult({ kind: lifecycleKind, article, pullRequest });
    }
    case 'check_failed': {
      const pullRequest = pullRequestValue(input.pullRequest, 'lifecycle.pullRequest', issues);
      const failedCheck = failedCheckValue(input.failedCheck, 'lifecycle.failedCheck', issues);
      if (issues.length > 0 || pullRequest === undefined || failedCheck === undefined)
        return errResult(issues);
      return okResult({ kind: 'check_failed', article, pullRequest, failedCheck });
    }
    case 'merged':
    case 'pending_deployment':
    case 'unpublish_pending':
    case 'archived': {
      const mainSha = shaValue(input.mainSha, 'lifecycle.mainSha', issues);
      if (issues.length > 0 || mainSha === undefined) return errResult(issues);
      const lifecycleKind = kind as
        'merged' | 'pending_deployment' | 'unpublish_pending' | 'archived';
      return okResult({ kind: lifecycleKind, article, mainSha });
    }
    case 'live': {
      const mainSha = shaValue(input.mainSha, 'lifecycle.mainSha', issues);
      const contentVersion = shaValue(input.contentVersion, 'lifecycle.contentVersion', issues);
      if (contentVersion !== undefined && !SHA64.test(contentVersion)) {
        collectIssues('lifecycle.contentVersion', issues, 'contentVersion');
      }
      const expected = indexEvidenceValue(input.expected, 'lifecycle.expected', issues);
      const observed = indexEvidenceValue(input.observed, 'lifecycle.observed', issues);
      if (article.status !== 'published') {
        collectIssues('lifecycle.article', issues, 'status');
      }
      if (expected !== undefined && observed !== undefined) {
        if (!indexEvidenceEquals(expected, observed)) {
          collectIssues('lifecycle', issues, 'evidenceMismatch');
        }
        if (expected.slug !== article.slug) {
          collectIssues('lifecycle.expected', issues, 'slugMismatch');
        }
      }
      if (
        issues.length > 0 ||
        mainSha === undefined ||
        contentVersion === undefined ||
        expected === undefined ||
        observed === undefined
      ) {
        return errResult(issues);
      }
      return okResult({ kind: 'live', article, mainSha, contentVersion, expected, observed });
    }
    case 'conflict': {
      const loaded = concurrencyEvidenceValue(input.loaded, 'lifecycle.loaded', issues);
      const current = concurrencyEvidenceValue(input.current, 'lifecycle.current', issues);
      if (issues.length > 0 || loaded === undefined || current === undefined)
        return errResult(issues);
      if (evidenceEquals(loaded, current)) {
        collectIssues('lifecycle.conflict', issues, 'identicalEvidence');
        return errResult(issues);
      }
      return okResult({ kind: 'conflict', article, loaded, current });
    }
    case 'failed': {
      stringIssue(input.phase, 'lifecycle.phase', issues, { max: 100 });
      const failure = failureValue(input.failure, 'lifecycle.failure', issues);
      if (issues.length > 0 || failure === undefined) return errResult(issues);
      return okResult({ kind: 'failed', article, phase: input.phase as string, failure });
    }
    case 'unknown':
      return okResult({ kind: 'unknown', article });
  }
  return errResult(['lifecycle.kind']);
}

export function decodeStudioPreview(input: unknown): DecodeResult<StudioPreviewResult> {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return errResult(['preview.object']);
  }
  const kind = input.kind;
  if (kind === 'preview_ok') {
    rejectUnknownKeys(input, ['kind', 'document', 'compileIssues'], 'preview', issues);
    if (issues.length > 0) return errResult(issues);
    let document: ArticleDocument;
    try {
      const parsed = ArticleDocumentSchema.safeParse(input.document);
      if (!parsed.success) {
        collectIssues('preview.document', issues, 'invalidDocument');
        return errResult(issues);
      }
      document = parsed.data;
    } catch {
      collectIssues('preview.document', issues, 'invalidDocument');
      return errResult(issues);
    }
    const compileIssues = compileIssuesValue(
      input.compileIssues,
      'preview.compileIssues',
      issues,
      false,
    );
    if (issues.length > 0 || compileIssues === undefined || compileIssues.length > 0) {
      if (compileIssues !== undefined && compileIssues.length > 0) {
        collectIssues('preview.compileIssues', issues, 'mustBeEmpty');
      }
      return errResult(issues);
    }
    return okResult({
      kind: 'preview_ok',
      document,
      compileIssues: [],
    });
  }
  if (kind === 'preview_issues') {
    rejectUnknownKeys(input, ['kind', 'compileIssues'], 'preview', issues);
    if (issues.length > 0) return errResult(issues);
    const compileIssues = compileIssuesValue(
      input.compileIssues,
      'preview.compileIssues',
      issues,
      true,
    );
    if (issues.length > 0 || compileIssues === undefined) return errResult(issues);
    return okResult({ kind: 'preview_issues', compileIssues });
  }
  return errResult(['preview.kind']);
}
