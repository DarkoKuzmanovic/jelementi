import {
  compileArticle,
  ContentCompileError,
  parseArticleSourceDraft,
} from '@jelementi/content-compiler';
import type { ArticleDocument } from '@jelementi/article-model';
import type { StudioCompileIssue } from '../../studio/contracts';
import type { GithubPublishAdapter, StudioPullRequest } from './github-adapter';

export interface StudioPublishOptions {
  mediaBaseUrl: string;
  fetch?: typeof globalThis.fetch;
  mediaTimeoutMs?: number;
}

export type StudioPublishResult =
  | {
      kind: 'published';
      pullRequest: { number: number; url: string };
      /** The head auto-merge is bound to: the post-flip head when a status flip landed. */
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
      phase: 'branch' | 'revalidate' | 'status-flip' | 'pull-request' | 'ready' | 'auto-merge';
      /**
       * 'topology' marks a GitHub-side state Publish cannot safely resolve on
       * its own (more than one open PR for the branch, or none at all) rather
       * than a transient GitHub error; 'transform' marks a purely local
       * failure to derive the published bytes — GitHub was never contacted.
       */
      reason: 'github' | 'topology' | 'transform';
    };

const STUDIO_PUBLISH_COMMIT_MESSAGE_MAX = 500;

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
 *  3. #111 Design A: when that committed draft's frontmatter status is still
 *     `draft`, Publish itself originates ONE byte-minimal status-flip commit
 *     (the only legitimate form-channel-free origin of `status: published`,
 *     mirroring Unpublish's archive commit). The flip is bounded by the same
 *     expected-head precondition as every Studio mutation — a head moved in
 *     between fails closed as `publish_conflict` — and the flipped bytes must
 *     compile BEFORE any write. The operator's exact-head approval covers the
 *     final content including the flip (stories 23/27): readiness and
 *     auto-merge are bound to the POST-flip head;
 *  4. the branch's sole open PR is flipped from Draft to ready
 *     (`updatePullRequest`);
 *  5. auto-merge is enabled for that PR, bound to the approved head — the
 *     post-flip head when a flip landed, otherwise `expectedHeadSha`
 *     (`enableAutoMerge`) — GitHub itself rejects a head that moved between
 *     steps 1 and 5, surfaced here as the same `publish_conflict`.
 *
 * Archived drafts stay blocked (`UNPUBLISHABLE_STATUS`, zero mutation):
 * only the draft→published first-publication path gains the flip.
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

  // #111 Design A: resolve what will actually be merged. Every rejection
  // below happens BEFORE any branch write, for BOTH status variants: the
  // flipped candidate is fully validated (compile + status gate + media
  // preflight) before its commit, exactly like the already-published path.
  const storedStatus = committedFrontmatterStatus(file.value.content, path);
  let approvalHeadSha = expectedHeadSha;
  if (storedStatus === 'archived') {
    return {
      kind: 'publish_rejected',
      compileIssues: [
        {
          code: 'UNPUBLISHABLE_STATUS',
          message: `Only draft articles can be published from Studio — Publish applies that status flip itself; this committed draft has status "archived". Archived articles cannot be re-published here.`,
          sourcePath: path,
        },
      ],
    };
  }

  if (storedStatus === 'draft') {
    const flippedSource = publishedSourceFrom(file.value.content);
    if (flippedSource === undefined) {
      // Fail closed: the flip must preserve every byte of the committed
      // source except the frontmatter `status` value. If that single field
      // cannot be transformed unambiguously, Publish never guesses — nothing
      // is written (mirrors Unpublish's archive transform discipline). This
      // is a local decision, not a GitHub outage.
      return { kind: 'publish_failed', phase: 'status-flip', reason: 'transform' };
    }
    // Zero-write rejection gate: the exact bytes that would be committed must
    // compile as a valid published article AND pass the media preflight
    // BEFORE the flip commit can land. A media failure here therefore leaves
    // the Studio branch byte-for-byte untouched.
    const candidate = await validatePublishedCandidate(flippedSource, path, options);
    if (candidate.kind === 'rejected') return candidate.result;
    const flip = await adapter.commitFile({
      branch: branchName,
      path,
      content: flippedSource,
      message: `Studio: publish ${slug}`.slice(0, STUDIO_PUBLISH_COMMIT_MESSAGE_MAX),
      expectedHeadSha,
    });
    if (!flip.ok) {
      if (flip.failure.reason === 'conflict') {
        const refreshed = await adapter.getBranch(branchName);
        return {
          kind: 'publish_conflict',
          expectedHeadSha,
          currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
        };
      }
      return { kind: 'publish_failed', phase: 'status-flip', reason: 'github' };
    }
    approvalHeadSha = flip.value.commitSha;
    // Exact-blob confirmation of what landed; the content was already fully
    // validated pre-write, so a mismatch here can only mean an unexpected
    // writer — fail closed as a conflict instead of re-deciding.
    const committed = await adapter.getFileContent(approvalHeadSha, path);
    if (!committed.ok || committed.value.content !== flippedSource) {
      return {
        kind: 'publish_conflict',
        expectedHeadSha: approvalHeadSha,
        currentHeadSha: branch.value.sha,
      };
    }
  } else {
    const existing = await validatePublishedCandidate(file.value.content, path, options);
    if (existing.kind === 'rejected') return existing.result;
  }

  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return { kind: 'publish_failed', phase: 'pull-request', reason: 'github' };
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  const pull: StudioPullRequest | undefined = openPulls[0];
  if (openPulls.length !== 1 || pull === undefined) {
    return { kind: 'publish_failed', phase: 'pull-request', reason: 'topology' };
  }
  // The approval chain ends at the post-flip head when a flip landed.
  if (pull.headSha !== approvalHeadSha) {
    return {
      kind: 'publish_conflict',
      expectedHeadSha: approvalHeadSha,
      currentHeadSha: pull.headSha,
    };
  }

  const ready = await adapter.updatePullRequest(pull.number, { draft: false });
  if (!ready.ok) return { kind: 'publish_failed', phase: 'ready', reason: 'github' };

  const autoMerge = await adapter.enableAutoMerge(pull.number, approvalHeadSha);
  if (!autoMerge.ok) {
    if (autoMerge.failure.reason === 'conflict') {
      // Re-read so the reported current head is accurate rather than
      // inferred from a stale local value.
      const refreshed = await adapter.getBranch(branchName);
      return {
        kind: 'publish_conflict',
        expectedHeadSha: approvalHeadSha,
        currentHeadSha: refreshed.ok ? refreshed.value.sha : null,
      };
    }
    return { kind: 'publish_failed', phase: 'auto-merge', reason: 'github' };
  }

  return {
    kind: 'published',
    pullRequest: { number: ready.value.number, url: ready.value.url },
    headSha: approvalHeadSha,
  };
}

/**
 * Tolerant frontmatter status read for a committed source (mirror of the
 * editor's recovery parse): an intentionally invalid draft still carries a
 * trustworthy raw status. Anything unparsable or unrecognizable reads as
 * `draft` — the only status Publish may legitimately transform.
 */
function committedFrontmatterStatus(
  source: string,
  sourcePath: string,
): 'draft' | 'published' | 'archived' {
  try {
    const status = (
      parseArticleSourceDraft(source, sourcePath).frontmatter as unknown as Record<string, unknown>
    ).status;
    if (status === 'draft' || status === 'published' || status === 'archived') return status;
  } catch {
    // An unparsable source has no trustworthy status at all.
  }
  return 'draft';
}

/**
 * Builds the publish source by replacing ONLY the committed frontmatter
 * `status` value (`draft` → `published`) inside the original bytes — never by
 * parsing and reserializing the whole source, which could reflow unrelated
 * YAML formatting (mirror image of Unpublish's archive transform). The raw
 * value must agree exactly with the tolerant parse above; the frontmatter
 * block must contain exactly one top-level `status:` line, otherwise the
 * transform fails closed (undefined) because it could not be done
 * unambiguously.
 */
function publishedSourceFrom(content: string): string | undefined {
  const blockMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (blockMatch === null) return undefined;
  const frontmatter = blockMatch[1];
  if (frontmatter === undefined) return undefined;
  const statusLineMatches = [...frontmatter.matchAll(/^status\s*:[^\r\n]*$/gm)];
  if (statusLineMatches.length !== 1) return undefined;
  const statusLine = statusLineMatches[0]?.[0];
  if (statusLine === undefined) return undefined;
  const statusValue = /^status\s*:\s*(\S.*)$/.exec(statusLine)?.[1];
  if (statusValue !== 'draft') return undefined;
  const valueIndex = statusLine.indexOf(statusValue);
  const lineStart =
    (blockMatch.index ?? 0) +
    blockMatch[0].indexOf(frontmatter) +
    (statusLineMatches[0]?.index ?? 0);
  const lineEnd = lineStart + statusLine.length;
  return (
    content.slice(0, lineStart) +
    statusLine.slice(0, valueIndex) +
    'published' +
    content.slice(lineEnd)
  );
}

type ValidatedPublishCandidate = { kind: 'ok' } | { kind: 'rejected'; result: StudioPublishResult };

/**
 * Compile, status gate, and media preflight for the exact bytes that would
 * be merged. Performs NO GitHub-adjacent writes, so every rejection it
 * produces leaves the Studio branch untouched regardless of stored status —
 * the invariant that lets both flip and no-flip paths run it before their
 * only commit (#111 Design A).
 */
async function validatePublishedCandidate(
  source: string,
  path: string,
  options: StudioPublishOptions,
): Promise<ValidatedPublishCandidate> {
  let document: ArticleDocument;
  try {
    const compiled = compileArticle({
      markdown: source,
      sourcePath: path,
      mediaBaseUrl: options.mediaBaseUrl,
    });
    // Spec (§Publish step 4): only a valid article with `status: published`
    // may proceed — it can never otherwise appear in the published index or
    // be proven Live. After the Design A flip this holds by construction;
    // the check stays as the defensive gate for the already-published path.
    if (compiled.document.status !== 'published') {
      return {
        kind: 'rejected',
        result: {
          kind: 'publish_rejected',
          compileIssues: [
            {
              code: 'UNPUBLISHABLE_STATUS',
              message: `Only draft articles can be published from Studio — Publish applies that status flip itself; this committed draft has status "${compiled.document.status}".`,
              sourcePath: path,
            },
          ],
        },
      };
    }
    document = compiled.document;
  } catch (cause) {
    if (cause instanceof ContentCompileError) {
      return {
        kind: 'rejected',
        result: { kind: 'publish_rejected', compileIssues: cause.issues },
      };
    }
    return {
      kind: 'rejected',
      result: {
        kind: 'publish_rejected',
        compileIssues: [
          {
            code: 'COMPILER_FAILURE',
            message: 'The article could not be compiled.',
            sourcePath: path,
          },
        ],
      },
    };
  }

  const mediaUrls = [
    document.cover.src,
    ...document.blocks.flatMap((block) => (block.type === 'image' ? [block.src] : [])),
    ...(document.audio === undefined ? [] : [document.audio.src]),
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.mediaTimeoutMs ?? 5_000);
  try {
    for (const mediaUrl of mediaUrls) {
      let media: Response;
      try {
        media = await (options.fetch ?? globalThis.fetch)(mediaUrl, {
          method: 'HEAD',
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
        });
      } catch {
        return {
          kind: 'rejected',
          result: {
            kind: 'publish_rejected',
            compileIssues: [
              mediaUnavailableIssue(
                path,
                mediaUrl,
                controller.signal.aborted ? 'request timed out' : 'request failed',
              ),
            ],
          },
        };
      }
      if (!media.ok) {
        return {
          kind: 'rejected',
          result: {
            kind: 'publish_rejected',
            compileIssues: [mediaUnavailableIssue(path, mediaUrl, `HTTP ${media.status}`)],
          },
        };
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return { kind: 'ok' };
}

function mediaUnavailableIssue(
  sourcePath: string,
  mediaUrl: string,
  reason: string,
): StudioCompileIssue {
  return {
    code: 'MEDIA_UNAVAILABLE',
    message: `Article media "${mediaUrl}" is unavailable: ${reason}.`,
    sourcePath,
  };
}
