import {
  compileArticle,
  ContentCompileError,
  parseArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import {
  articleContentFingerprint,
  categorySlug,
  type ArticleDocument,
} from '@jelementi/article-model';
import type {
  GithubAdapterResult,
  GithubReadAdapter,
  StudioBranch,
  StudioCheckRun,
  StudioPullRequest,
} from './github-adapter';
import {
  indexEvidenceEquals,
  type StudioArticleListEntry,
  type StudioArticleRef,
  type StudioChangeState,
  type StudioCompileIssue,
  type StudioFailureCategory,
  type StudioIndexEvidence,
  type StudioLifecycle,
  type StudioLiveEvidence,
  type StudioProductionState,
} from '../../studio/contracts';
import {
  probeIndexJson,
  probeUrl,
  type ProbeIndexResult,
  type ProbeOptions,
  type ProbeResult,
  type ProbeSpec,
} from './probe.server';

const ARTICLE_PATH_PATTERN = /^content\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const STUDIO_BRANCH_PATTERN = /^studio\/article\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const CHECK_NAME = 'verify';

export type StudioArticleListFailureReason = 'github' | 'topology' | 'invalid-canonical';

export interface StudioArticleListFailure {
  phase: 'main' | 'canonical' | 'branches' | 'pull-request' | 'check';
  reason: StudioArticleListFailureReason;
}

export type StudioArticleListResult =
  { ok: true; value: StudioArticleListEntry[] } | { ok: false; failure: StudioArticleListFailure };

export interface StudioArticleListOptions {
  productionOrigin: string;
  checkName?: string;
}

interface CanonicalArticle {
  filePath: string;
  blobSha: string;
  frontmatter: ArticleSourceFrontmatter;
}

/**
 * Reconstructs the Studio list from the current GitHub topology.
 *
 * This function deliberately keeps no lifecycle state: every call reads main,
 * canonical article files, Studio branches, pull requests, and required
 * checks, then joins those observations into a display projection. Any
 * ambiguous topology is rejected rather than guessed at.
 */
export async function deriveStudioArticleList(
  adapter: GithubReadAdapter,
  options: StudioArticleListOptions,
): Promise<StudioArticleListResult> {
  const main = await adapter.getMainRef();
  if (!main.ok) return githubFailure('main', main);

  const canonicalFiles = await adapter.listArticleFiles(main.value.sha);
  if (!canonicalFiles.ok) return githubFailure('canonical', canonicalFiles);

  const canonical = new Map<string, CanonicalArticle>();
  for (const file of canonicalFiles.value) {
    const match = ARTICLE_PATH_PATTERN.exec(file.path);
    if (match === null) return invalidCanonicalFailure();
    const slug = match[1];
    if (slug === undefined || canonical.has(slug)) return topologyFailure('canonical');
    try {
      const parsed = parseArticleSource(file.content, file.path);
      canonical.set(slug, {
        filePath: file.path,
        blobSha: file.blobSha,
        frontmatter: parsed.frontmatter,
      });
    } catch {
      return invalidCanonicalFailure();
    }
  }

  const branches = await adapter.listStudioBranches();
  if (!branches.ok) return githubFailure('branches', branches);

  const branchesBySlug = new Map<string, StudioBranch>();
  for (const branch of branches.value) {
    const match = STUDIO_BRANCH_PATTERN.exec(branch.name);
    const slug = match?.[1];
    if (slug === undefined || !canonical.has(slug)) return topologyFailure('branches');
    if (branchesBySlug.has(slug)) return topologyFailure('branches');
    branchesBySlug.set(slug, branch);
  }

  const rows: StudioArticleListEntry[] = [];
  for (const [slug, article] of canonical) {
    const branch = branchesBySlug.get(slug);
    const draft = await deriveDraftState(
      adapter,
      slug,
      article,
      branch,
      options.checkName ?? CHECK_NAME,
    );
    if (!draft.ok) return draft;
    rows.push({
      slug,
      title: article.frontmatter.title,
      canonicalStatus: article.frontmatter.status,
      updatedAt: article.frontmatter.updatedAt,
      production: productionState(article.frontmatter.status),
      change: draft.change,
      ...(article.frontmatter.status === 'published'
        ? { publicUrl: `${options.productionOrigin.replace(/\/$/, '')}/articles/${slug}` }
        : {}),
      ...(branch === undefined ? {} : { branch: toBranchRef(branch) }),
      ...(draft.pullRequest === undefined
        ? {}
        : { pullRequest: toPullRequestRef(draft.pullRequest) }),
      ...(draft.check === undefined ? {} : { check: toCheckEvidence(draft.check) }),
    });
  }

  rows.sort((left, right) => left.slug.localeCompare(right.slug));
  return { ok: true, value: rows };
}

async function deriveDraftState(
  adapter: GithubReadAdapter,
  slug: string,
  canonical: { filePath: string; blobSha?: string },
  branch: StudioBranch | undefined,
  checkName: string,
): Promise<
  | {
      ok: true;
      change: StudioChangeState;
      pullRequest?: StudioPullRequest;
      check?: StudioCheckRun;
    }
  | { ok: false; failure: { phase: 'pull-request' | 'check'; reason: 'github' | 'topology' } }
> {
  const branchName = branch?.name ?? `studio/article/${slug}`;
  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return githubFailure('pull-request', pulls);
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  if (openPulls.length > 1) return topologyFailure('pull-request');
  if (branch === undefined && openPulls.length > 0) return topologyFailure('pull-request');
  for (const pull of pulls.value) {
    if (pull.headRef !== branchName || pull.baseRef !== 'main') {
      return topologyFailure('pull-request');
    }
  }

  const mergedPulls = pulls.value.filter((pull) => pull.state === 'merged');
  if (branch === undefined && mergedPulls.length > 0) {
    const matchingMergedPulls: StudioPullRequest[] = [];
    for (const mergedPull of mergedPulls) {
      if (mergedPull.mergeCommitSha === undefined) {
        return topologyFailure('pull-request');
      }
      const mergedFile = await adapter.getFileContent(
        mergedPull.mergeCommitSha,
        canonical.filePath,
      );
      if (!mergedFile.ok) return githubFailure('pull-request', mergedFile);
      if (mergedFile.value.blobSha === canonical.blobSha) {
        matchingMergedPulls.push(mergedPull);
      }
    }
    if (matchingMergedPulls.length > 1) return topologyFailure('pull-request');
    if (matchingMergedPulls.length === 1) {
      return { ok: true, change: 'merged', pullRequest: matchingMergedPulls[0] };
    }
  }
  const pull = openPulls[0];
  if (pull === undefined) {
    return branch === undefined ? { ok: true, change: 'none' } : { ok: true, change: 'draft' };
  }
  if (branch !== undefined && pull.headSha !== branch.sha) {
    return topologyFailure('pull-request');
  }
  if (pull.draft) return { ok: true, change: 'draft', pullRequest: pull };

  const check = await adapter.getCheckRun(pull.number, checkName, pull.headSha);
  if (!check.ok) return githubFailure('check', check);
  if (check.value === null) return { ok: true, change: 'ready', pullRequest: pull };
  if (check.value.status !== 'completed') {
    return { ok: true, change: 'checking', pullRequest: pull, check: check.value };
  }
  if (check.value.conclusion !== 'success') {
    return { ok: true, change: 'check_failed', pullRequest: pull, check: check.value };
  }
  return { ok: true, change: 'ready', pullRequest: pull, check: check.value };
}

function productionState(status: ArticleSourceFrontmatter['status']): StudioProductionState {
  // Probe evidence owns `live` and proven removal (#17/T5). Until that
  // evidence exists, GitHub-only state stays conservatively pending rather
  // than claiming a public fact from frontmatter alone.
  if (status === 'archived') return 'pending_removal';
  if (status === 'published') return 'pending_deployment';
  return 'absent';
}

function toBranchRef(branch: StudioBranch) {
  return { name: branch.name, url: branch.url, headSha: branch.sha };
}

function toPullRequestRef(pull: StudioPullRequest) {
  return { number: pull.number, url: pull.url, headSha: pull.headSha };
}

function toCheckEvidence(check: StudioCheckRun) {
  return {
    name: check.name,
    status: check.status,
    conclusion: check.conclusion,
    ...(check.url === undefined ? {} : { url: check.url }),
  };
}

// Generic over the phase literal so both the multi-article list (whose
// failures span main/canonical/branches/pull-request/check) and the
// single-article status projection (main/canonical/branch/pull-request/
// check/compile) can share one github/topology failure shape without
// widening either phase union to accept the other's phases.
function githubFailure<P extends string>(
  phase: P,
  result: GithubAdapterResult<unknown>,
): { ok: false; failure: { phase: P; reason: 'github' | 'topology' } } {
  return {
    ok: false,
    failure: {
      phase,
      reason: !result.ok && result.failure.reason === 'topology' ? 'topology' : 'github',
    },
  };
}

function topologyFailure<P extends string>(
  phase: P,
): { ok: false; failure: { phase: P; reason: 'topology' } } {
  return { ok: false, failure: { phase, reason: 'topology' } };
}

function invalidCanonicalFailure(): {
  ok: false;
  failure: StudioArticleListFailure;
} {
  return { ok: false, failure: { phase: 'canonical', reason: 'invalid-canonical' } };
}

// === Single-article status (#17/T5) ===
//
// Unlike `deriveStudioArticleList` (a read-only, never-probing projection
// for the list page), this reconstructs the full `StudioLifecycle` for one
// article and, when explicitly asked via `includeProbe`, runs the bounded
// production probes that are the only path to `live` (CONTEXT.md, spec).
// Ordinary page loads pass `includeProbe: false`; only an explicit Refresh
// action re-reads GitHub AND re-runs probes — there is no background
// polling.

export interface StudioArticleStatusFailure {
  phase: 'main' | 'canonical' | 'branch' | 'pull-request' | 'check' | 'compile';
  reason: 'github' | 'topology' | 'invalid-canonical';
}

export type StudioArticleStatusResult =
  { ok: true; value: StudioLifecycle } | { ok: false; failure: StudioArticleStatusFailure };

export interface StudioArticleStatusOptions {
  productionOrigin: string;
  checkName?: string;
  /** Runs the bounded production probes (article fingerprint + public
   * index) needed to resolve `live` vs `pending_deployment`. False for an
   * ordinary page load; true only for an explicit Refresh action. */
  includeProbe: boolean;
  mediaBaseUrl: string;
  now?: () => string;
  probeArticle?: (spec: ProbeSpec, options?: ProbeOptions) => Promise<ProbeResult>;
  probeIndex?: (spec: ProbeSpec, options?: ProbeOptions) => Promise<ProbeIndexResult>;
  probeOptions?: ProbeOptions;
}

export async function deriveStudioArticleStatus(
  adapter: GithubReadAdapter,
  slug: string,
  options: StudioArticleStatusOptions,
): Promise<StudioArticleStatusResult> {
  const main = await adapter.getMainRef();
  if (!main.ok) return githubFailure('main', main);

  const filePath = `content/articles/${slug}.md`;
  const fileResult = await adapter.getFileContent(main.value.sha, filePath);
  let canonical:
    | { filePath: string; blobSha: string; frontmatter: ArticleSourceFrontmatter; content: string }
    | undefined;
  if (fileResult.ok) {
    try {
      const parsed = parseArticleSource(fileResult.value.content, filePath);
      canonical = {
        filePath,
        blobSha: fileResult.value.blobSha,
        frontmatter: parsed.frontmatter,
        content: fileResult.value.content,
      };
    } catch {
      return { ok: false, failure: { phase: 'canonical', reason: 'invalid-canonical' } };
    }
  } else if (fileResult.failure.reason !== 'not-found') {
    return githubFailure('canonical', fileResult);
  }

  const branchName = `studio/article/${slug}`;
  const branchResult = await adapter.getBranch(branchName);
  let branch: StudioBranch | undefined;
  if (branchResult.ok) {
    branch = branchResult.value;
  } else if (branchResult.failure.reason !== 'not-found') {
    return githubFailure('branch', branchResult);
  }

  const draft = await deriveDraftState(
    adapter,
    slug,
    canonical === undefined ? { filePath } : canonical,
    branch,
    options.checkName ?? CHECK_NAME,
  );
  if (!draft.ok) return draft;

  const article = articleRefFrom(slug, canonical, options);

  switch (draft.change) {
    case 'none': {
      if (canonical === undefined) return { ok: true, value: { kind: 'unknown', article } };
      if (canonical.frontmatter.status === 'archived') {
        if (!options.includeProbe) {
          // A plain load never claims `archived`: absence is a negative public
          // fact only an explicit Refresh can prove. Until then the article is
          // conservatively still in flight.
          return {
            ok: true,
            value: { kind: 'unpublish_pending', article, mainSha: main.value.sha },
          };
        }
        return {
          ok: true,
          value: await resolveProbedAbsence(article, main.value.sha, slug, options),
        };
      }
      if (canonical.frontmatter.status === 'draft') {
        return { ok: true, value: { kind: 'unknown', article } };
      }
      if (!options.includeProbe) {
        return {
          ok: true,
          value: { kind: 'pending_deployment', article, mainSha: main.value.sha },
        };
      }
      return {
        ok: true,
        value: await resolveProbedStatus(article, main.value.sha, canonical, options),
      };
    }
    case 'draft': {
      if (branch === undefined) {
        return { ok: false, failure: { phase: 'branch', reason: 'topology' } };
      }
      // The change axis (this article's edit draft) and the production axis
      // (whether the currently published canonical article is proven Live)
      // are independent facts (CONTEXT.md: Live persists while an edit draft
      // exists). Only an explicit Refresh probes; a positive `productionLive`
      // is attached only when both probes actually proved Live, never
      // inferred — its absence just means "not proven live right now".
      const productionLive =
        options.includeProbe &&
        canonical !== undefined &&
        canonical.frontmatter.status === 'published'
          ? await liveEvidenceIfProven(main.value.sha, canonical, slug, options)
          : undefined;
      const draftFile = await adapter.getFileContent(branch.sha, filePath);
      if (!draftFile.ok) return githubFailure('branch', draftFile);
      try {
        compileArticle({
          markdown: draftFile.value.content,
          sourcePath: filePath,
          mediaBaseUrl: options.mediaBaseUrl,
        });
        return {
          ok: true,
          value: {
            kind: 'draft_valid',
            article,
            branch: toBranchRef(branch),
            ...(productionLive === undefined ? {} : { productionLive }),
          },
        };
      } catch (cause) {
        const issues =
          cause instanceof ContentCompileError ? cause.issues : [compilerFailureIssue(filePath)];
        return {
          ok: true,
          value: {
            kind: 'draft_invalid',
            article,
            branch: toBranchRef(branch),
            issues,
            ...(productionLive === undefined ? {} : { productionLive }),
          },
        };
      }
    }
    case 'ready': {
      if (draft.pullRequest === undefined) {
        return { ok: false, failure: { phase: 'pull-request', reason: 'topology' } };
      }
      return {
        ok: true,
        value: { kind: 'ready', article, pullRequest: toPullRequestRef(draft.pullRequest) },
      };
    }
    case 'checking': {
      if (draft.pullRequest === undefined) {
        return { ok: false, failure: { phase: 'pull-request', reason: 'topology' } };
      }
      return {
        ok: true,
        value: { kind: 'checking', article, pullRequest: toPullRequestRef(draft.pullRequest) },
      };
    }
    case 'check_failed': {
      if (draft.pullRequest === undefined || draft.check === undefined) {
        return { ok: false, failure: { phase: 'check', reason: 'topology' } };
      }
      return {
        ok: true,
        value: {
          kind: 'check_failed',
          article,
          pullRequest: toPullRequestRef(draft.pullRequest),
          failedCheck: {
            name: draft.check.name,
            ...(draft.check.url === undefined ? {} : { url: draft.check.url }),
          },
        },
      };
    }
    case 'merged': {
      if (!options.includeProbe) {
        return { ok: true, value: { kind: 'merged', article, mainSha: main.value.sha } };
      }
      if (canonical === undefined) {
        return {
          ok: true,
          value: { kind: 'pending_deployment', article, mainSha: main.value.sha },
        };
      }
      if (canonical.frontmatter.status === 'archived') {
        // A merged Unpublish: absence is a negative public fact, proven only
        // when BOTH bounded probes agree on an explicit Refresh. Every
        // partial or failed signal stays `unpublish_pending`.
        return {
          ok: true,
          value: await resolveProbedAbsence(article, main.value.sha, slug, options),
        };
      }
      return {
        ok: true,
        value: await resolveProbedStatus(article, main.value.sha, canonical, options),
      };
    }
  }
}

function articleRefFrom(
  slug: string,
  canonical: { frontmatter: ArticleSourceFrontmatter } | undefined,
  options: Pick<StudioArticleStatusOptions, 'productionOrigin' | 'now'>,
): StudioArticleRef {
  if (canonical !== undefined) {
    const trimmedOrigin = options.productionOrigin.replace(/\/$/, '');
    return {
      slug,
      title: canonical.frontmatter.title,
      status: canonical.frontmatter.status,
      updatedAt: canonical.frontmatter.updatedAt,
      ...(canonical.frontmatter.status === 'published'
        ? { url: `${trimmedOrigin}/articles/${slug}` }
        : {}),
    };
  }
  // A brand-new article has no canonical file yet (its Draft PR has not
  // merged). A richer ref could be derived from the branch's own draft
  // content, but that is a deliberate simplification documented at close:
  // the placeholder is only ever seen pre-merge, before there is any public
  // fact to protect.
  return {
    slug,
    title: 'Untitled article',
    status: 'draft',
    updatedAt: options.now?.() ?? new Date().toISOString(),
  };
}

function compilerFailureIssue(sourcePath: string): StudioCompileIssue {
  return {
    code: 'COMPILER_FAILURE',
    message: 'The article could not be compiled.',
    sourcePath,
    line: 1,
    column: 1,
  };
}

function articleIndexEvidence(document: ArticleDocument): StudioIndexEvidence | undefined {
  if (document.publishedAt === undefined) return undefined;
  return {
    slug: document.slug,
    title: document.title,
    excerpt: document.excerpt,
    publishedAt: document.publishedAt,
    updatedAt: document.updatedAt,
    category: document.category,
    categorySlug: categorySlug(document.category),
    tags: document.tags,
    author: document.author,
    cover: document.cover,
    readingTimeMinutes: document.readingTimeMinutes,
  };
}

/** A reachable-but-erroring (non-2xx) probe means "not yet propagated", not
 * a system failure — only genuine unreachability (timeout/network/config)
 * is a `failed` result. Spec: "timeout/absence yields unknown/failed". */
function probeIsUnreachable(reason: string | undefined): boolean {
  return (
    reason === 'timeout' ||
    reason === 'network' ||
    reason === 'config' ||
    reason === 'invalid-url' ||
    reason === 'non-http'
  );
}

function probeFailureCategory(reason: string | undefined): StudioFailureCategory {
  return reason === 'timeout' ? 'timeout' : 'probe';
}

type ProbeReconciliation =
  | { outcome: 'live'; evidence: StudioLiveEvidence }
  | { outcome: 'pending' }
  | { outcome: 'failed'; phase: 'compile' | 'probe'; category: StudioFailureCategory };

/**
 * Recompiles the canonical article, runs both bounded production probes
 * (article fingerprint + public index) in parallel, and reconciles them
 * into the one fact both `resolveProbedStatus` (production-axis kinds) and
 * the `draft` change-state (attaching `productionLive` evidence) need:
 * whether the currently published version is actually proven Live right
 * now. Shared so "Live persists while an edit draft exists" (CONTEXT.md) is
 * backed by one reconciliation path, not two that could disagree.
 */
async function reconcileProbes(
  mainSha: string,
  canonical: { filePath: string; content: string },
  slug: string,
  options: StudioArticleStatusOptions,
): Promise<ProbeReconciliation> {
  let document: ArticleDocument;
  try {
    document = compileArticle({
      markdown: canonical.content,
      sourcePath: canonical.filePath,
      mediaBaseUrl: options.mediaBaseUrl,
    }).document;
  } catch {
    return { outcome: 'failed', phase: 'compile', category: 'validation' };
  }
  const expectedIndex = articleIndexEvidence(document);
  if (expectedIndex === undefined) {
    return { outcome: 'failed', phase: 'compile', category: 'validation' };
  }

  const trimmedOrigin = options.productionOrigin.replace(/\/$/, '');
  const articleUrl = `${trimmedOrigin}/articles/${slug}`;
  const indexUrl = `${trimmedOrigin}/index.json`;
  const probeArticleFn = options.probeArticle ?? probeUrl;
  const probeIndexFn = options.probeIndex ?? probeIndexJson;

  const [articleProbe, indexProbe] = await Promise.all([
    probeArticleFn({ name: 'article', target: { url: articleUrl } }, options.probeOptions),
    probeIndexFn({ name: 'index', target: { url: indexUrl } }, options.probeOptions),
  ]);

  if (!articleProbe.ok) {
    if (probeIsUnreachable(articleProbe.reason)) {
      return {
        outcome: 'failed',
        phase: 'probe',
        category: probeFailureCategory(articleProbe.reason),
      };
    }
    return { outcome: 'pending' };
  }

  if (!indexProbe.ok) {
    if (indexProbe.reason !== 'invalid-body' && probeIsUnreachable(indexProbe.reason)) {
      return {
        outcome: 'failed',
        phase: 'probe',
        category: probeFailureCategory(indexProbe.reason),
      };
    }
    return { outcome: 'pending' };
  }

  const expectedFingerprint = await articleContentFingerprint(document);
  if (articleProbe.fingerprint !== expectedFingerprint) {
    return { outcome: 'pending' };
  }

  const observedIndex = indexProbe.entries.find((entry) => entry.slug === slug);
  if (observedIndex === undefined || !indexEvidenceEquals(expectedIndex, observedIndex)) {
    return { outcome: 'pending' };
  }

  return {
    outcome: 'live',
    evidence: {
      mainSha,
      contentVersion: expectedFingerprint,
      expected: expectedIndex,
      observed: observedIndex,
    },
  };
}

/**
 * Same reconciliation as `resolveProbedStatus`, but for attaching evidence
 * to a `draft_valid`/`draft_invalid` result: only a proven `live` outcome
 * is surfaced (as `StudioLiveEvidence`); `pending`/`failed` outcomes are
 * swallowed to `undefined`; `draft_valid`/`draft_invalid` have no field to
 * carry them, and "not proven live right now" is already the safe default.
 */
async function liveEvidenceIfProven(
  mainSha: string,
  canonical: { filePath: string; content: string },
  slug: string,
  options: StudioArticleStatusOptions,
): Promise<StudioLiveEvidence | undefined> {
  const reconciliation = await reconcileProbes(mainSha, canonical, slug, options);
  return reconciliation.outcome === 'live' ? reconciliation.evidence : undefined;
}

/**
 * Resolves whether an `archived` canonical article is actually absent from
 * production. `archived` is reported only when BOTH bounded probes agree:
 * the public index no longer lists the slug AND the article route returns
 * the custom 404. One signal, wrong status, stale content, or a probe
 * timeout all stay `unpublish_pending` — absence is never inferred from a
 * single observation.
 */
async function resolveProbedAbsence(
  article: StudioArticleRef,
  mainSha: string,
  slug: string,
  options: StudioArticleStatusOptions,
): Promise<StudioLifecycle> {
  const trimmedOrigin = options.productionOrigin.replace(/\/$/, '');
  const articleUrl = `${trimmedOrigin}/articles/${slug}`;
  const indexUrl = `${trimmedOrigin}/index.json`;
  const probeArticleFn = options.probeArticle ?? probeUrl;
  const probeIndexFn = options.probeIndex ?? probeIndexJson;

  const [articleProbe, indexProbe] = await Promise.all([
    probeArticleFn({ name: 'article', target: { url: articleUrl } }, options.probeOptions),
    probeIndexFn({ name: 'index', target: { url: indexUrl } }, options.probeOptions),
  ]);

  const indexAbsent = indexProbe.ok && !indexProbe.entries.some((entry) => entry.slug === slug);
  const routeNotFound = !articleProbe.ok && articleProbe.status === 404;
  if (indexAbsent && routeNotFound) {
    return { kind: 'archived', article, mainSha };
  }
  return { kind: 'unpublish_pending', article, mainSha };
}

async function resolveProbedStatus(
  article: StudioArticleRef,
  mainSha: string,
  canonical: { filePath: string; content: string },
  options: StudioArticleStatusOptions,
): Promise<StudioLifecycle> {
  const reconciliation = await reconcileProbes(mainSha, canonical, article.slug, options);
  switch (reconciliation.outcome) {
    case 'live':
      return { kind: 'live', article, ...reconciliation.evidence };
    case 'pending':
      return { kind: 'pending_deployment', article, mainSha };
    case 'failed':
      return {
        kind: 'failed',
        article,
        phase: reconciliation.phase,
        failure: { category: reconciliation.category },
      };
  }
}
