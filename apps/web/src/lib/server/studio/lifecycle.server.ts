import { parseArticleSource, type ArticleSourceFrontmatter } from '@jelementi/content-compiler';
import type {
  GithubAdapterResult,
  GithubReadAdapter,
  StudioBranch,
  StudioCheckRun,
  StudioPullRequest,
} from './github-adapter';
import type {
  StudioArticleListEntry,
  StudioChangeState,
  StudioProductionState,
} from '../../studio/contracts';

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
  canonical: CanonicalArticle,
  branch: StudioBranch | undefined,
  checkName: string,
): Promise<
  | {
      ok: true;
      change: StudioChangeState;
      pullRequest?: StudioPullRequest;
      check?: StudioCheckRun;
    }
  | { ok: false; failure: StudioArticleListFailure }
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

function githubFailure(
  phase: StudioArticleListFailure['phase'],
  result: GithubAdapterResult<unknown>,
): { ok: false; failure: StudioArticleListFailure } {
  return {
    ok: false,
    failure: {
      phase,
      reason: !result.ok && result.failure.reason === 'topology' ? 'topology' : 'github',
    },
  };
}

function topologyFailure(phase: StudioArticleListFailure['phase']): {
  ok: false;
  failure: StudioArticleListFailure;
} {
  return { ok: false, failure: { phase, reason: 'topology' } };
}

function invalidCanonicalFailure(): {
  ok: false;
  failure: StudioArticleListFailure;
} {
  return { ok: false, failure: { phase: 'canonical', reason: 'invalid-canonical' } };
}
