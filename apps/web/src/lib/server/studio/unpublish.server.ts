import {
  compileArticle,
  ContentCompileError,
  parseArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import type { StudioCompileIssue } from '../../studio/contracts';
import type { GithubPublishAdapter, StudioPullRequest } from './github-adapter';

export interface StudioUnpublishOptions {
  mediaBaseUrl: string;
}

export type StudioUnpublishResult =
  | {
      kind: 'unpublish_submitted';
      /** The exact archive commit head the auto-merge is bound to. */
      commitSha: string;
      pullRequest: { number: number; url: string };
    }
  | {
      kind: 'unpublish_conflict';
      expectedHeadSha: string;
      currentHeadSha: string | null;
    }
  | {
      kind: 'unpublish_rejected';
      compileIssues: StudioCompileIssue[];
    }
  | {
      kind: 'unpublish_blocked';
      reason: 'differing-draft' | 'not-published';
    }
  | {
      kind: 'unpublish_failed';
      /** Names the failed operation phase so failures are always actionable. */
      phase:
        | 'main'
        | 'canonical'
        | 'branch'
        | 'commit'
        | 'revalidate'
        | 'pull-request'
        | 'ready'
        | 'auto-merge';
      /**
       * 'topology' marks a GitHub-side state Unpublish cannot safely resolve
       * on its own (a branch with no committed article file, more than one
       * open PR) rather than a transient GitHub error.
       */
      reason: 'github' | 'topology';
    };

const STUDIO_UNPUBLISH_COMMIT_MESSAGE_MAX = 500;
const STUDIO_UNPUBLISH_PR_TITLE_MAX = 500;

interface ParsedArticleSource {
  frontmatter: ArticleSourceFrontmatter;
  body: string;
}

/**
 * Unpublish archives the currently published canonical article through the
 * same one-draft topology as Publish (ADR-0004): a Studio branch carries an
 * archive commit that changes ONLY the frontmatter `status` value to
 * `archived` — every other byte of the canonical source is preserved — the
 * exact committed blob is revalidated, the sole Draft PR is flipped ready,
 * and auto-merge is enabled bound to that exact archive head.
 *
 * Fresh discovery, no trust in a prior page load:
 *
 *  1. the canonical article on `main` must be `published` — anything else is
 *     `unpublish_blocked` (`not-published`);
 *  2. an existing committed draft is compared by exact content identity
 *     against canonical main: a differing draft — even one that differs only
 *     in YAML formatting — blocks Unpublish (`differing-draft`) and is never
 *     overwritten; a draft identical to main is archived in place; a draft
 *     that already IS the archive change is reused, making a retry
 *     idempotent (no duplicate branch, commit, or PR);
 *  3. the archive change must compile before any write, and the exact
 *     committed blob at the archive head is revalidated after the write;
 *  4. exactly one open PR for the branch is flipped ready and auto-merge is
 *     enabled for the exact archive head SHA — GitHub rejects a head that
 *     moved in between, surfaced as `unpublish_conflict`.
 *
 * Once auto-merge is enabled, Studio performs no further branch mutation.
 * Absence in production is proven only later by an explicit Refresh, never
 * claimed here.
 */
export async function unpublishStudioArticle(
  adapter: GithubPublishAdapter,
  slug: string,
  options: StudioUnpublishOptions,
): Promise<StudioUnpublishResult> {
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;

  const main = await adapter.getMainRef();
  if (!main.ok) return { kind: 'unpublish_failed', phase: 'main', reason: 'github' };

  const canonicalFile = await adapter.getFileContent(main.value.sha, path);
  if (!canonicalFile.ok) {
    if (canonicalFile.failure.reason === 'not-found') {
      return { kind: 'unpublish_blocked', reason: 'not-published' };
    }
    return { kind: 'unpublish_failed', phase: 'canonical', reason: 'github' };
  }
  let canonical: ParsedArticleSource;
  try {
    canonical = parseArticleSource(canonicalFile.value.content, path);
  } catch {
    return { kind: 'unpublish_failed', phase: 'canonical', reason: 'github' };
  }
  if (canonical.frontmatter.status !== 'published') {
    return { kind: 'unpublish_blocked', reason: 'not-published' };
  }

  const archiveSource = archiveSourceFrom(canonicalFile.value.content);
  if (archiveSource === undefined) {
    // Fail closed: the archive change must preserve every byte of the
    // canonical source except the frontmatter `status` value. If that single
    // field cannot be transformed unambiguously, Unpublish never guesses —
    // nothing is written.
    return { kind: 'unpublish_failed', phase: 'canonical', reason: 'github' };
  }
  // Zero-write rejection gate: the archive change must compile before ANY
  // branch write (creation, commit, or PR) can land. `commitFile` writes
  // exactly `archiveSource`, so this is the same bytes the exact-commit
  // revalidation below checks.
  try {
    compileArticle({
      markdown: archiveSource,
      sourcePath: path,
      mediaBaseUrl: options.mediaBaseUrl,
    });
  } catch (cause) {
    if (cause instanceof ContentCompileError) {
      return { kind: 'unpublish_rejected', compileIssues: cause.issues };
    }
    return {
      kind: 'unpublish_rejected',
      compileIssues: [compilerFailureIssue(path)],
    };
  }

  const branchRead = await adapter.getBranch(branchName);
  if (!branchRead.ok && branchRead.failure.reason !== 'not-found') {
    return { kind: 'unpublish_failed', phase: 'branch', reason: 'github' };
  }
  let branch = branchRead.ok ? branchRead.value : undefined;
  if (branch === undefined) {
    const created = await adapter.createBranch(branchName, main.value.sha);
    if (!created.ok) {
      if (created.failure.reason === 'conflict') {
        // Lost a race to create the branch — re-read rather than report an
        // opaque failure, so discovery continues against fresh topology.
        const refreshed = await adapter.getBranch(branchName);
        if (!refreshed.ok) {
          return { kind: 'unpublish_failed', phase: 'branch', reason: 'github' };
        }
        branch = refreshed.value;
      } else {
        return { kind: 'unpublish_failed', phase: 'branch', reason: 'github' };
      }
    } else {
      branch = created.value;
    }
  }

  const branchFile = await adapter.getFileContent(branch.sha, path);
  if (!branchFile.ok) {
    if (branchFile.failure.reason === 'not-found') {
      // A Studio branch always commits the article file; its absence is an
      // unexpected topology Unpublish cannot reconcile with a draft.
      return { kind: 'unpublish_failed', phase: 'branch', reason: 'topology' };
    }
    return { kind: 'unpublish_failed', phase: 'branch', reason: 'github' };
  }
  try {
    parseArticleSource(branchFile.value.content, path);
  } catch {
    return { kind: 'unpublish_failed', phase: 'branch', reason: 'topology' };
  }

  // Compare by exact content identity, never parsed semantic equality: a
  // committed draft that differs from canonical main in ANY byte — including
  // YAML formatting-only differences — is an active draft that blocks
  // Unpublish and is never overwritten.
  const committedContent = branchFile.value.content;
  const needsCommit = committedContent !== archiveSource;
  if (needsCommit && committedContent !== canonicalFile.value.content) {
    return { kind: 'unpublish_blocked', reason: 'differing-draft' };
  }

  let archiveSha = branch.sha;
  if (needsCommit) {
    const commit = await adapter.commitFile({
      branch: branchName,
      path,
      content: archiveSource,
      message: `Studio: unpublish ${slug}`.slice(0, STUDIO_UNPUBLISH_COMMIT_MESSAGE_MAX),
      expectedHeadSha: branch.sha,
    });
    if (!commit.ok) {
      if (commit.failure.reason === 'conflict') {
        const refreshed = await adapter.getBranch(branchName);
        return {
          kind: 'unpublish_conflict',
          expectedHeadSha: branch.sha,
          currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
        };
      }
      return { kind: 'unpublish_failed', phase: 'commit', reason: 'github' };
    }
    archiveSha = commit.value.commitSha;
  }

  // Validate the exact committed archive blob at the archive head (also the
  // only validation a reused archive commit gets).
  const committed = await adapter.getFileContent(archiveSha, path);
  if (!committed.ok) {
    if (committed.failure.reason === 'not-found') {
      return {
        kind: 'unpublish_conflict',
        expectedHeadSha: archiveSha,
        currentHeadSha: branch.sha,
      };
    }
    return { kind: 'unpublish_failed', phase: 'revalidate', reason: 'github' };
  }
  try {
    compileArticle({
      markdown: committed.value.content,
      sourcePath: path,
      mediaBaseUrl: options.mediaBaseUrl,
    });
  } catch (cause) {
    if (cause instanceof ContentCompileError) {
      return { kind: 'unpublish_rejected', compileIssues: cause.issues };
    }
    return {
      kind: 'unpublish_rejected',
      compileIssues: [compilerFailureIssue(path)],
    };
  }

  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return { kind: 'unpublish_failed', phase: 'pull-request', reason: 'github' };
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  if (openPulls.length > 1) {
    return { kind: 'unpublish_failed', phase: 'pull-request', reason: 'topology' };
  }
  let pull: StudioPullRequest | undefined = openPulls[0];
  if (pull === undefined) {
    const created = await adapter.createPullRequest({
      title: `Studio: unpublish ${slug}`.slice(0, STUDIO_UNPUBLISH_PR_TITLE_MAX),
      body: studioUnpublishPullRequestBody(slug),
      head: branchName,
      base: 'main',
      draft: true,
    });
    if (!created.ok) {
      return {
        kind: 'unpublish_failed',
        phase: 'pull-request',
        // A 'topology' failure here means the adapter itself detected an open
        // PR that appeared after the discovery above — preserve it rather
        // than flattening to a generic failure.
        reason: created.failure.reason === 'topology' ? 'topology' : 'github',
      };
    }
    pull = created.value;
  }
  if (pull.headRef !== branchName || pull.baseRef !== 'main') {
    return { kind: 'unpublish_failed', phase: 'pull-request', reason: 'topology' };
  }
  if (pull.headSha !== archiveSha) {
    return {
      kind: 'unpublish_conflict',
      expectedHeadSha: archiveSha,
      currentHeadSha: pull.headSha,
    };
  }

  const ready = await adapter.updatePullRequest(pull.number, { draft: false });
  if (!ready.ok) return { kind: 'unpublish_failed', phase: 'ready', reason: 'github' };

  const autoMerge = await adapter.enableAutoMerge(pull.number, archiveSha);
  if (!autoMerge.ok) {
    if (autoMerge.failure.reason === 'conflict') {
      const refreshed = await adapter.getBranch(branchName);
      return {
        kind: 'unpublish_conflict',
        expectedHeadSha: archiveSha,
        currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
      };
    }
    return { kind: 'unpublish_failed', phase: 'auto-merge', reason: 'github' };
  }

  return {
    kind: 'unpublish_submitted',
    commitSha: archiveSha,
    pullRequest: { number: pull.number, url: pull.url },
  };
}

function studioUnpublishPullRequestBody(slug: string): string {
  return `Studio unpublish for \`content/articles/${slug}.md\`. Archives the article after merge.`;
}

/**
 * Builds the archive source by replacing ONLY the canonical frontmatter
 * `status` value (`published` → `archived`) inside the original bytes —
 * never by parsing and reserializing the whole source, which could reflow
 * unrelated YAML formatting. The canonical status was already validated as
 * `published`, so the raw value must agree exactly; the frontmatter block
 * must contain exactly one top-level `status:` line, otherwise the transform
 * fails closed (undefined) because it could not be done unambiguously.
 */
function archiveSourceFrom(canonicalContent: string): string | undefined {
  const blockMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(canonicalContent);
  if (blockMatch === null) return undefined;
  const frontmatter = blockMatch[1];
  if (frontmatter === undefined) return undefined;
  const statusLineMatches = [...frontmatter.matchAll(/^status\s*:[^\r\n]*$/gm)];
  if (statusLineMatches.length !== 1) return undefined;
  const statusLine = statusLineMatches[0]?.[0];
  if (statusLine === undefined) return undefined;
  const statusValue = /^status\s*:\s*(\S.*)$/.exec(statusLine)?.[1];
  if (statusValue !== 'published') return undefined;
  const valueIndex = statusLine.indexOf(statusValue);
  const lineStart =
    (blockMatch.index ?? 0) +
    blockMatch[0].indexOf(frontmatter) +
    (statusLineMatches[0]?.index ?? 0);
  const lineEnd = lineStart + statusLine.length;
  return (
    canonicalContent.slice(0, lineStart) +
    statusLine.slice(0, valueIndex) +
    'archived' +
    canonicalContent.slice(lineEnd)
  );
}

function compilerFailureIssue(sourcePath: string): StudioCompileIssue {
  return {
    code: 'COMPILER_FAILURE',
    message: 'The article could not be compiled.',
    sourcePath,
  };
}
