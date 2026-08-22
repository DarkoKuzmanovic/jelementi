import { error } from '@sveltejs/kit';
import {
  decodeStudioFormData,
  loadNewStudioEditor,
  loadStudioEditor,
  previewFromEditorInput,
  reconstructStudioPreviewInput,
  saveStudioDraft,
} from './editor.server';
import { getStudioConfig, type StudioConfig } from './config.server';
import { replaceStudioDraft, type StudioDraftReplacementResult } from './draft-replacement.server';
import type { GithubAdapter, GithubReadAdapter, GithubSaveAdapter } from './github-adapter';
import { requireStudioAccess, requireStudioMutation } from './request-guard.server';
import {
  buildStudioValidationProjection,
  type StudioValidationProjection,
} from './validation-projection.server';
import type {
  StudioEditorData,
  StudioPreviewInput,
  StudioPreviewOptions,
  StudioSaveResult,
} from './editor.server';
import { buildStudioActionEnvelope, type StudioActionEnvelope } from '../../studio/action-envelope';
import {
  buildStudioWorkspaceProjection,
  type StudioWorkspaceProjection,
} from '../../studio/workspace-projection';
import type {
  StudioCompileIssue,
  StudioEditorInput,
  StudioLifecycle,
  StudioPreviewResult,
} from '../../studio/contracts';

const MAX_SLUG_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface StudioEditorRouteEvent {
  request: Request;
  platform: App.Platform | undefined;
  locals: Record<string, unknown>;
}

export interface StudioPreviewActionData {
  preview: StudioPreviewResult;
  editor?: StudioPreviewInput;
  /**
   * Shared decoded action-response envelope (#78). Present on the
   * server-accepted path; full-navigation rendering and enhanced rendering
   * consume the same envelope — only delivery differs. Absent on early
   * rejection paths the enhanced client never reaches (it falls through to
   * native submission when its bounded snapshot capture fails).
   */
  envelope?: StudioActionEnvelope;
}

export interface StudioSaveActionData {
  save: StudioSaveResult;
  editor?: StudioPreviewInput;
  /**
   * Server-authored canonical slug accepted by this Save (#78 decision B).
   * On `/studio/articles/new` the enhanced client migrates the matching
   * `new` recovery snapshot and navigates to `/studio/articles/<slug>`;
   * immutable slug enforcement stays entirely server-side.
   */
  acceptedSlug?: string;
  validation?: StudioValidationProjection;
  envelope?: StudioActionEnvelope;
}

export interface StudioDraftReplacementActionData {
  replacement: StudioDraftReplacementResult;
  editor: StudioPreviewInput;
  status?: StudioLifecycle;
}

export async function loadNewStudioEditorPage(
  event: StudioEditorRouteEvent,
): Promise<{ editor: StudioEditorData }> {
  await requireStudioAccess(event);
  const adapter = event.locals.studioGithubAdapter as GithubReadAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio editor unavailable.');
  const loaded = await loadNewStudioEditor(adapter);
  if (!loaded.ok) error(503, 'Studio editor unavailable.');
  return { editor: loaded.value };
}

export async function loadStudioEditorPage(
  event: StudioEditorRouteEvent,
  slug: string,
): Promise<{ editor: StudioEditorData }> {
  await requireStudioAccess(event);
  if (!isStudioSlug(slug)) error(400, 'Invalid article slug.');

  const adapter = event.locals.studioGithubAdapter as GithubReadAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio editor unavailable.');

  const loaded = await loadStudioEditor(adapter, slug);
  if (!loaded.ok) {
    if (loaded.failure.reason === 'not-found') error(404, 'Studio article not found.');
    error(503, 'Studio editor unavailable.');
  }
  return { editor: loaded.value };
}

export async function previewStudioEditorAction(
  event: StudioEditorRouteEvent,
  expectedSlug?: string,
): Promise<StudioPreviewActionData> {
  await requireStudioMutation(event);
  if (expectedSlug !== undefined && !isStudioSlug(expectedSlug)) {
    error(400, 'Invalid article slug.');
  }
  let mediaBaseUrl: string;
  try {
    mediaBaseUrl = getStudioConfig(event.platform?.env).mediaBaseUrl;
  } catch {
    error(503, 'Studio preview unavailable.');
  }

  const form = await event.request.formData();
  const decoded = decodeStudioFormData(form);
  if (!decoded.ok) {
    return invalidFormPreview(form, expectedSlug);
  }
  if (expectedSlug !== undefined && decoded.value.metadata.slug !== expectedSlug) {
    const submitted = reconstructStudioPreviewInput(form);
    return {
      preview: immutableSlugPreview(expectedSlug),
      editor: {
        metadata: { ...submitted.metadata, slug: expectedSlug },
        body: submitted.body,
      },
    };
  }
  const preview = previewFromEditorInput(decoded.value, { mediaBaseUrl });
  return {
    preview,
    editor: { metadata: decoded.value.metadata, body: decoded.value.body },
    envelope: buildStudioActionEnvelope(envelopeIds(form, 'preview'), {
      kind: 'preview',
      preview,
    }),
  };
}

/**
 * Mirrors `previewStudioEditorAction`'s boundary shape: `expectedSlug` is
 * present for an established article route and absent for the new-article
 * route, where the submitted form's own (validated) slug is the target.
 */
export async function saveStudioEditorAction(
  event: StudioEditorRouteEvent,
  expectedSlug?: string,
): Promise<StudioSaveActionData> {
  await requireStudioMutation(event);
  if (expectedSlug !== undefined && !isStudioSlug(expectedSlug)) {
    error(400, 'Invalid article slug.');
  }
  let studioConfig: StudioConfig;
  try {
    studioConfig = getStudioConfig(event.platform?.env);
  } catch {
    error(503, 'Studio save unavailable.');
  }
  const mediaBaseUrl = studioConfig.mediaBaseUrl;

  const adapter = event.locals.studioGithubAdapter as GithubSaveAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio save unavailable.');

  const form = await event.request.formData();
  const decoded = decodeStudioFormData(form);
  if (!decoded.ok) {
    return invalidFormSave(form, expectedSlug);
  }
  if (expectedSlug !== undefined && decoded.value.metadata.slug !== expectedSlug) {
    const submitted = reconstructStudioPreviewInput(form);
    return {
      save: immutableSlugSave(expectedSlug),
      editor: {
        metadata: { ...submitted.metadata, slug: expectedSlug },
        body: submitted.body,
      },
    };
  }

  const save = await saveOrRejectSlugCollision(adapter, decoded.value, expectedSlug === undefined, {
    mediaBaseUrl,
  });
  const candidate = { metadata: decoded.value.metadata, body: decoded.value.body };
  const compileIssues =
    save.kind === 'saved' || save.kind === 'save_rejected' ? save.compileIssues : [];
  const validation = buildStudioValidationProjection(compileIssues, candidate);
  const envelope = buildStudioActionEnvelope(envelopeIds(form, 'save'), {
    kind: 'save',
    save,
    workspace: saveWorkspaceProjection(
      save,
      decoded.value,
      studioConfig.github.owner,
      studioConfig.github.repo,
    ),
    ...(validation === undefined ? {} : { validation }),
  });
  return {
    save,
    editor: candidate,
    ...(validation === undefined ? {} : { validation }),
    // Server-authored canonical slug for the FIRST successful Save on the
    // new-article route only (#78 decision: server-authored enhanced
    // redirect). The enhanced client migrates the matching `new` Recovery
    // record and navigates to `/studio/articles/<slug>`; immutable-slug
    // enforcement stays entirely server-side. Never emitted for an
    // established article route or a Save that the server did not accept.
    ...(expectedSlug === undefined && save.kind === 'saved'
      ? { acceptedSlug: decoded.value.metadata.slug }
      : {}),
    envelope,
  };
}

export async function replaceStudioEditorAction(
  event: StudioEditorRouteEvent,
  expectedSlug: string,
): Promise<StudioDraftReplacementActionData> {
  await requireStudioMutation(event);
  if (!isStudioSlug(expectedSlug)) error(400, 'Invalid article slug.');

  const form = await event.request.formData();
  const decoded = decodeStudioFormData(form);
  const reconstructed = reconstructStudioPreviewInput(form);
  reconstructed.metadata.slug = expectedSlug;
  if (!decoded.ok || decoded.value.metadata.slug !== expectedSlug) {
    return {
      replacement: {
        kind: 'replacement_failed',
        candidate: reconstructed,
        phase: 'decode-request',
        reason: 'validation',
        // Rejected before any GitHub call — provably nothing was mutated.
        mutation: 'none',
        evidence: {},
      },
      editor: reconstructed,
    };
  }

  let mediaBaseUrl: string;
  try {
    mediaBaseUrl = getStudioConfig(event.platform?.env).mediaBaseUrl;
  } catch {
    error(503, 'Studio draft replacement unavailable.');
  }
  const adapter = event.locals.studioGithubAdapter as GithubAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio draft replacement unavailable.');

  const candidate = { metadata: decoded.value.metadata, body: decoded.value.body };
  const replacement = await replaceStudioDraft(
    adapter,
    expectedSlug,
    candidate,
    decoded.value.concurrency,
    { mediaBaseUrl },
  );
  if (replacement.kind !== 'replaced') return { replacement, editor: candidate };
  const article = {
    slug: candidate.metadata.slug,
    title: candidate.metadata.title,
    status: candidate.metadata.status,
    updatedAt: candidate.metadata.updatedAt,
  };
  const status: StudioLifecycle =
    replacement.compileIssues.length === 0
      ? { kind: 'draft_valid', article, branch: replacement.branch }
      : {
          kind: 'draft_invalid',
          article,
          branch: replacement.branch,
          issues: replacement.compileIssues,
        };
  return { replacement, editor: candidate, status };
}

/**
 * Bounded correlation ids for the action-response envelope (#78). The
 * enhanced client submits them as hidden fields; full navigation falls
 * back to bounded server-derived ids. They are correlation tokens, never
 * authority — the server only echoes them and never trusts them.
 */
function envelopeIds(
  form: FormData,
  fallback: string,
): { operationId: string; submittedSnapshotId: string } {
  const bounded = (value: FormDataEntryValue | null): string | undefined => {
    if (typeof value !== 'string' || value.length === 0 || value.length > 200) return undefined;
    return /^[A-Za-z0-9._-]{1,200}$/.test(value) ? value : undefined;
  };
  return {
    operationId: bounded(form.get('enhancementOperationId')) ?? `${fallback}-${Date.now()}`,
    submittedSnapshotId:
      bounded(form.get('submittedSnapshotId')) ?? `${fallback}-snapshot-${Date.now()}`,
  };
}

/**
 * Refreshed workspace projection composed from the authoritative Save
 * result (spec #72: "Save nests the existing Save result plus refreshed
 * workspace projection/concurrency"). Every mapped lifecycle kind is
 * derived only from domain facts the Save result actually carries — the
 * browser never reclassifies or reinterprets anything. The concurrency
 * evidence advances ONLY from the authoritative Save result (never from
 * the submitted form's stale evidence), and the Studio branch URL is the
 * deterministic GitHub tree URL — never the Draft PR URL.
 */
function saveWorkspaceProjection(
  save: StudioSaveResult,
  input: StudioEditorInput,
  owner: string,
  repo: string,
): StudioWorkspaceProjection {
  const article = {
    slug: input.metadata.slug,
    title: input.metadata.title,
    status: input.metadata.status,
    updatedAt: input.metadata.updatedAt,
  };
  const branchName = `studio/article/${input.metadata.slug}`;
  let lifecycle: StudioLifecycle;
  let concurrency = input.concurrency;
  if (save.kind === 'saved') {
    // Only a successful Save produces advanced concurrency; the submitted
    // evidence is stale by definition at that point.
    concurrency = save.concurrency;
    const branch = {
      name: branchName,
      url: `https://github.com/${owner}/${repo}/tree/${branchName}`,
      headSha:
        save.concurrency.draftHeadSha ??
        save.concurrency.expectedBlobSha ??
        save.concurrency.baseMainSha,
    };
    lifecycle =
      save.compileIssues.length > 0
        ? { kind: 'draft_invalid', article, branch, issues: save.compileIssues }
        : { kind: 'draft_valid', article, branch };
  } else if (save.kind === 'save_conflict') {
    lifecycle = { kind: 'conflict', article, loaded: save.loaded, current: save.current };
  } else if (save.kind === 'save_failed') {
    lifecycle = {
      kind: 'failed',
      article,
      phase: save.phase,
      failure: { category: save.reason === 'topology' ? 'conflict' : 'github' },
    };
    // A post-commit partial failure carries the advanced evidence.
    concurrency = save.concurrency ?? concurrency;
  } else {
    // save_rejected: the form could not be decoded, so no lifecycle claim
    // is invented — the workspace stays "Status unavailable".
    lifecycle = { kind: 'unknown', article };
  }
  return buildStudioWorkspaceProjection(lifecycle, concurrency);
}

/**
 * #109 new-article slug safety: on the new-article route (no expected
 * slug), saving is rejected BEFORE any GitHub mutation when the submitted
 * slug already belongs to a canonical article file on `main` or to an
 * active Studio draft branch. Established article routes are exempt —
 * their own canonical file and their own draft are the legitimate edit
 * target, not collisions. Only definitive positive evidence rejects: a
 * lookup that cannot be completed fails closed as a plain GitHub failure
 * rather than risking the silent-overwrite hazard.
 */
async function saveOrRejectSlugCollision(
  adapter: GithubSaveAdapter,
  input: StudioEditorInput,
  isNewArticleRoute: boolean,
  options: StudioPreviewOptions,
): Promise<StudioSaveResult> {
  if (!isNewArticleRoute) {
    return saveStudioDraft(adapter, input.metadata.slug, input, options);
  }
  const collision = await findStudioSlugCollision(adapter, input.metadata.slug);
  if (collision === undefined) {
    return saveStudioDraft(adapter, input.metadata.slug, input, options);
  }
  if (collision === 'unavailable') {
    return { kind: 'save_failed', phase: 'main', reason: 'github' };
  }
  if (collision.kind === 'article') {
    return {
      kind: 'save_rejected',
      compileIssues: [
        slugCollisionIssue(
          'SLUG_ALREADY_EXISTS',
          input.metadata.slug,
          'An article with this slug already exists — open it instead.',
        ),
      ],
    };
  }
  return {
    kind: 'save_rejected',
    compileIssues: [
      slugCollisionIssue(
        'SLUG_DRAFT_EXISTS',
        input.metadata.slug,
        `A Studio draft for this slug already exists${
          collision.pullRequestNumber === undefined ? '' : ` (PR #${collision.pullRequestNumber})`
        }. Open it, pick a different slug, or discard the existing draft.`,
      ),
    ],
  };
}

type StudioSlugCollision =
  { kind: 'article' } | { kind: 'draft'; pullRequestNumber?: number } | 'unavailable';

/** Read-only collision discovery; never mutates anything. */
async function findStudioSlugCollision(
  adapter: GithubReadAdapter,
  slug: string,
): Promise<StudioSlugCollision | undefined> {
  const main = await adapter.getMainRef();
  if (!main.ok) return 'unavailable';
  const path = `content/articles/${slug}.md`;
  const canonical = await adapter.getFileContent(main.value.sha, path);
  if (canonical.ok) return { kind: 'article' };
  if (canonical.failure.reason !== 'not-found') return 'unavailable';

  const branchName = `studio/article/${slug}`;
  const branch = await adapter.getBranch(branchName);
  if (branch.ok) {
    // Best-effort PR naming for the message; a failed read only omits it.
    const pulls = await adapter.listPullRequests(branchName);
    const openPull = pulls.ok ? pulls.value.find((pull) => pull.state === 'open') : undefined;
    return {
      kind: 'draft',
      ...(openPull === undefined ? {} : { pullRequestNumber: openPull.number }),
    };
  }
  if (branch.failure.reason !== 'not-found') return 'unavailable';
  return undefined;
}

function slugCollisionIssue(
  code: 'SLUG_ALREADY_EXISTS' | 'SLUG_DRAFT_EXISTS',
  slug: string,
  message: string,
): StudioCompileIssue {
  return {
    code,
    message,
    sourcePath: `content/articles/${slug}.md`,
    line: 1,
    column: 1,
  };
}

function invalidFormPreview(form: FormData, expectedSlug?: string): StudioPreviewActionData {
  const submitted = reconstructStudioPreviewInput(form);
  const slug = invalidFormSlug(form, expectedSlug);
  if (expectedSlug !== undefined) submitted.metadata.slug = expectedSlug;
  return {
    preview: {
      kind: 'preview_issues',
      compileIssues: [invalidEditorInputIssue(slug)],
    },
    editor: submitted,
  };
}

function invalidFormSave(form: FormData, expectedSlug?: string): StudioSaveActionData {
  const submitted = reconstructStudioPreviewInput(form);
  const slug = invalidFormSlug(form, expectedSlug);
  if (expectedSlug !== undefined) submitted.metadata.slug = expectedSlug;
  return {
    save: { kind: 'save_rejected', compileIssues: [invalidEditorInputIssue(slug)] },
    editor: submitted,
  };
}

function invalidFormSlug(form: FormData, expectedSlug?: string): string {
  const submittedSlug = form.get('slug');
  return (
    expectedSlug ??
    (typeof submittedSlug === 'string' && isStudioSlug(submittedSlug)
      ? submittedSlug
      : 'new-article')
  );
}

function invalidEditorInputIssue(slug: string): {
  code: string;
  message: string;
  sourcePath: string;
  line: number;
  column: number;
} {
  return {
    code: 'INVALID_EDITOR_INPUT',
    message: 'Review the article fields and try again.',
    sourcePath: `content/articles/${slug}.md`,
    line: 1,
    column: 1,
  };
}

function isStudioSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

function immutableSlugPreview(expectedSlug: string): StudioPreviewResult {
  return { kind: 'preview_issues', compileIssues: [slugImmutableIssue(expectedSlug)] };
}

function immutableSlugSave(expectedSlug: string): StudioSaveResult {
  return { kind: 'save_rejected', compileIssues: [slugImmutableIssue(expectedSlug)] };
}

function slugImmutableIssue(expectedSlug: string): {
  code: string;
  message: string;
  sourcePath: string;
  line: number;
  column: number;
} {
  return {
    code: 'SLUG_IMMUTABLE',
    message: 'The slug cannot change after the first saved draft.',
    sourcePath: `content/articles/${expectedSlug}.md`,
    line: 1,
    column: 1,
  };
}
