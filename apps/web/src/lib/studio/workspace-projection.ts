import type {
  StudioArticleStatus,
  StudioConcurrencyEvidence,
  StudioLifecycle,
  StudioStatusKind,
} from './contracts';
import { STUDIO_ISO_DATE_PATTERN } from './contracts';
import {
  isConcludedSuccessfulCheck,
  STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING,
  STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS,
  studioChecksPassedMerging,
} from './evidence-copy';

/**
 * Studio workspace projection — the presentation seam for #73.
 *
 * A server-authored composite view laid *above* the existing
 * `StudioLifecycle` domain result. It never replaces `StudioLifecycle` (the
 * authoritative wire contract routes still return, unchanged) — it composes
 * it into the plain-language, two-axis facts the Studio UI needs: what is
 * currently published (the "Published version" axis) and what the operator
 * is working on right now (the "Working change" axis), kept editorially
 * separate per the two-axis lifecycle model in CONTEXT.md.
 *
 * Every decoder in this module follows the zero-dependency, never-throwing
 * style of `contracts.ts`: bounded strings, closed key sets, stable
 * non-echoing issue codes, no descent into unknown keys.
 */

export const STUDIO_PUBLISHED_VERSION_LABELS = [
  'Not published',
  'Updating the site',
  'Live and verified',
  'Published — not verified',
  'Archived — not verified',
  'Removing from the site',
  'Removed and verified',
] as const;
export type StudioPublishedVersionLabel = (typeof STUDIO_PUBLISHED_VERSION_LABELS)[number];

export const STUDIO_WORKING_CHANGE_LABELS = [
  'Not saved yet',
  'Saved — needs fixes',
  'Ready to publish',
  STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS,
  STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING,
  'Checks running',
  'Checks failed',
  'Merged — site update pending',
  'No changes in progress',
  'Changes need review',
  'Status unavailable',
] as const;
export type StudioWorkingChangeLabel = (typeof STUDIO_WORKING_CHANGE_LABELS)[number];

export interface StudioActionAvailability {
  available: boolean;
  reason?: string;
}

export interface StudioEvidenceRow {
  label: string;
  value: string;
  url?: string;
}

export interface StudioPublishedVersion {
  label: StudioPublishedVersionLabel;
  /**
   * #116: when the verified outcome was observed (bounded ISO instant).
   * Present only with probe-proven labels (`Live and verified`,
   * `Removed and verified`); lets the UI render "Live — verified <time>"
   * so a verified claim stays visibly bounded in time.
   */
  verifiedAt?: string;
}

export interface StudioWorkspaceProjection {
  slug: string;
  title: string;
  publishedVersion: StudioPublishedVersion;
  workingChange: { label: StudioWorkingChangeLabel };
  summary: string;
  recommendedAction: string;
  readerEffect: string;
  /**
   * Always-visible, plain-language validation state (#72: "validation
   * summary" — a count/severity/phase summary of compile issues, never
   * hidden behind Evidence disclosure; "validation failure and Publish
   * blocking never [disclose only in Evidence]"). Empty compile issues on
   * a non-draft kind read as "No validation issues."
   */
  validationSummary: string;
  actions: {
    preview: StudioActionAvailability;
    save: StudioActionAvailability;
    publish: StudioActionAvailability;
    refresh: StudioActionAvailability;
    unpublish: StudioActionAvailability;
    discard: StudioActionAvailability;
  };
  concurrency: StudioConcurrencyEvidence;
  evidence: StudioEvidenceRow[];
}

const MAX_TEXT = 2_000;
const MAX_VALIDATION_SUMMARY = 2_000;
const MAX_LABEL = 200;
const MAX_URL = 2_048;
const MAX_EVIDENCE_ROWS = 50;
const HTTPS_PATTERN = /^https:\/\//i;
const SAFE_KEY = /^[A-Za-z0-9._-]{1,32}$/;
const VERIFIED_AT_PATTERN = new RegExp(`^${STUDIO_ISO_DATE_PATTERN}$`);

/**
 * Per-kind axis + action-availability mapping. Purely presentational: it
 * reads the domain `StudioLifecycle` kind and article status, and never
 * invents new domain truth. #116 keeps the three lifecycle situations
 * verbally distinct: transitional copy only for genuinely known-recent
 * transitions (`merged`, probed `pending_deployment`, `unpublish_pending`),
 * probe-proven claims for verified outcomes, and honest neutral
 * "not verified on this screen" for everything else — silence about
 * production truth is never upgraded to a transition or a positive claim.
 */
function derivePublishedVersion(
  kind: StudioStatusKind,
  articleStatus: StudioArticleStatus,
  productionLiveProven: boolean,
): StudioPublishedVersionLabel {
  switch (kind) {
    case 'merged':
    case 'pending_deployment':
      return 'Updating the site';
    case 'live':
      return 'Live and verified';
    case 'unpublish_pending':
      return 'Removing from the site';
    case 'archived':
      return 'Removed and verified';
    case 'unverified':
      if (articleStatus === 'archived') return 'Archived — not verified';
      return 'Published — not verified';
    default:
      // Without proven evidence and without a known-recent transition, the
      // honest state is neutral "not verified on this screen" (#116) —
      // never claimed live/removed from GitHub status alone.
      if (productionLiveProven) return 'Live and verified';
      if (articleStatus === 'published') return 'Published — not verified';
      if (articleStatus === 'archived') return 'Archived — not verified';
      return 'Not published';
  }
}

function checksPassedOnReady(lifecycle: StudioLifecycle): boolean {
  // #117: "checks passed — merging" requires an observed, COMPLETED,
  // successful check run. Anything else — no check yet, queued/running, or
  // any non-success conclusion — stays honestly in the waiting state. The
  // predicate itself is shared with the Flowboard and publish panel.
  return lifecycle.kind === 'ready' && isConcludedSuccessfulCheck(lifecycle.check);
}

function deriveWorkingChange(lifecycle: StudioLifecycle): StudioWorkingChangeLabel {
  const kind = lifecycle.kind;
  switch (kind) {
    case 'draft_invalid':
      return 'Saved — needs fixes';
    case 'draft_valid':
      return 'Ready to publish';
    case 'ready':
      // #117: a concluded-successful check pre-merge is factually past the
      // waiting-to-start stage — GitHub is merging it. The distinction uses
      // only check-run presence/conclusion already fetched upstream; no new
      // lifecycle state exists.
      return checksPassedOnReady(lifecycle)
        ? STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING
        : STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS;
    case 'checking':
      return 'Checks running';
    case 'check_failed':
      return 'Checks failed';
    case 'merged':
    case 'pending_deployment':
      return 'Merged — site update pending';
    case 'live':
    case 'unverified':
    case 'unpublish_pending':
    case 'archived':
      return 'No changes in progress';
    case 'conflict':
      return 'Changes need review';
    case 'failed':
    case 'unknown':
      return 'Status unavailable';
    default:
      return 'Status unavailable';
  }
}

const SUMMARY_BY_KIND: Readonly<Record<StudioStatusKind, string>> = {
  draft_invalid: 'This draft has issues that must be fixed before it can be published.',
  draft_valid: 'This draft is saved and ready to publish.',
  // #117: overridden with the checks-passed—merging copy set below when a
  // concluded-successful check pre-merge is observed; otherwise unchanged.
  ready: 'This change has been submitted and is waiting for checks to start.',
  checking: 'Checks are running on this change.',
  check_failed:
    'Checks failed on this change. The Draft PR stays open with auto-merge still enabled; nothing was merged.',
  merged: 'This change has been merged and the site update is in progress.',
  pending_deployment: 'The site update is still in progress.',
  // #116: honest neutral — no transition phrasing for an unprobed steady state.
  unverified: 'No change is underway, but this screen has not verified the public site recently.',
  live: 'The published version is live and verified in production.',
  unpublish_pending: 'This article is being removed from the site.',
  archived: 'This article has been removed from the site and verified absent.',
  conflict: 'This draft was saved from an out-of-date version. Review before continuing.',
  failed: 'Something went wrong while working on this article.',
  unknown: 'The status of this article could not be determined.',
} as const;

const RECOMMENDED_ACTION_BY_KIND: Readonly<Record<StudioStatusKind, string>> = {
  draft_invalid: 'Fix the reported issues, then save again.',
  draft_valid: 'Publish this draft when you are ready.',
  // #117: overridden with the checks-passed—merging copy set below when a
  // concluded-successful check pre-merge is observed; otherwise unchanged.
  ready: 'Wait for checks to start, or check status again shortly.',
  checking: 'Wait for checks to finish.',
  // #117: both sanctioned exit paths after a failed check, spelled out —
  // fix-and-republish (needs a new approval) or re-run unchanged (does not).
  check_failed:
    'Two ways forward: fix the reported problem, then Save and run Publish again (this needs a new approval), or leave your content unchanged and re-run the failed check on GitHub — the check then completes without needing a new Publish approval, and auto-merge finishes on its own.',
  merged: 'Wait for the site update to finish, then check status.',
  pending_deployment: 'Check status again shortly.',
  unverified: 'Check status to verify what readers currently see.',
  live: 'No action needed.',
  unpublish_pending: 'Wait for the removal to finish, then check status.',
  archived: 'No action needed.',
  conflict: 'Review the current version before saving again.',
  failed: 'Try again, or check status for more detail.',
  unknown: 'Check status to refresh what is known about this article.',
} as const;

const READER_EFFECT_BY_KIND: Readonly<Record<StudioStatusKind, string>> = {
  draft_invalid: 'Readers see no change from this draft.',
  draft_valid: 'Readers see no change until this draft is published.',
  ready: 'Readers see no change while this change is pending.',
  checking: 'Readers see no change while checks run.',
  check_failed: 'Readers see no change while checks are failing.',
  merged: 'Readers will see this change once the site update finishes.',
  pending_deployment: 'Readers will see this change once the site update finishes.',
  live: 'Readers currently see this published version.',
  // #116: honest neutral — say what is not known without implying motion.
  unverified: 'What readers currently see has not been verified on this screen.',
  unpublish_pending: 'Readers will stop seeing this article once removal finishes.',
  archived: 'Readers no longer see this article.',
  conflict: 'Readers see no change from this draft.',
  failed: 'Readers see no change from this attempted action.',
  unknown: 'What readers currently see is not known right now.',
} as const;

/**
 * Always-visible validation state (#72 line 109: "always-visible
 * count/severity/phase and source-linked issues; ... validation failure
 * and Publish blocking never [hide behind Evidence]"). Only `draft_invalid`
 * carries compile issues today; every other kind has none to report.
 */
function deriveValidationSummary(lifecycle: StudioLifecycle): string {
  if (lifecycle.kind !== 'draft_invalid') return 'No validation issues.';
  const count = lifecycle.issues.length;
  const phases = [...new Set(lifecycle.issues.map((issue) => issue.sourcePath))];
  const phaseList = phases.slice(0, 3).join(', ') + (phases.length > 3 ? ', …' : '');
  return `${count} validation ${count === 1 ? 'issue' : 'issues'} found in ${phaseList}; fix before publishing.`;
}

function actionsForKind(kind: StudioStatusKind): StudioWorkspaceProjection['actions'] {
  const blocked = (reason: string): StudioActionAvailability => ({ available: false, reason });
  const open: StudioActionAvailability = { available: true };
  const neverForKind = blocked('Not applicable to the current status.');

  const preview: StudioActionAvailability =
    kind === 'draft_invalid' || kind === 'draft_valid' || kind === 'conflict' ? open : neverForKind;
  const save: StudioActionAvailability =
    kind === 'draft_invalid' || kind === 'draft_valid' || kind === 'conflict' ? open : neverForKind;
  const publish: StudioActionAvailability =
    kind === 'draft_valid'
      ? open
      : kind === 'draft_invalid'
        ? blocked('Fix the reported issues before publishing.')
        : neverForKind;
  const refresh: StudioActionAvailability =
    kind === 'ready' ||
    kind === 'checking' ||
    kind === 'check_failed' ||
    kind === 'merged' ||
    kind === 'pending_deployment' ||
    // #116: checking is exactly the remedy for an unverified steady state.
    kind === 'unverified' ||
    kind === 'unpublish_pending' ||
    kind === 'unknown'
      ? open
      : neverForKind;
  const unpublish: StudioActionAvailability = kind === 'live' ? open : neverForKind;
  const discard: StudioActionAvailability =
    kind === 'ready' || kind === 'checking' || kind === 'check_failed' ? open : neverForKind;

  return { preview, save, publish, refresh, unpublish, discard };
}

/**
 * #116: deterministic UTC rendering of a verification stamp, e.g.
 * "2026-08-22 14:02 UTC". Malformed or absent input yields "" — the UI
 * then shows the bare label instead of an invented time.
 */
export function formatStudioVerifiedAt(verifiedAt: string | undefined): string {
  if (verifiedAt === undefined) return '';
  const parsed = new Date(verifiedAt);
  if (Number.isNaN(parsed.getTime())) return '';
  const iso = parsed.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** The verified-at stamp this lifecycle carries, if any (#116). */
function verifiedAtOf(
  lifecycle: StudioLifecycle,
  productionLiveProven: boolean,
): string | undefined {
  if (lifecycle.kind === 'live' || lifecycle.kind === 'archived') {
    return lifecycle.verifiedAt;
  }
  if (
    productionLiveProven &&
    (lifecycle.kind === 'draft_invalid' || lifecycle.kind === 'draft_valid') &&
    lifecycle.productionLive
  ) {
    return lifecycle.productionLive.verifiedAt;
  }
  return undefined;
}

/**
 * Composes the existing `StudioLifecycle` domain result (plus its
 * originating concurrency evidence) into the presentation projection. Pure
 * and deterministic: same lifecycle in, same projection out.
 */
export function buildStudioWorkspaceProjection(
  lifecycle: StudioLifecycle,
  concurrency: StudioConcurrencyEvidence,
): StudioWorkspaceProjection {
  const productionLiveProven =
    (lifecycle.kind === 'draft_invalid' || lifecycle.kind === 'draft_valid') &&
    lifecycle.productionLive !== undefined;
  const verifiedAt = verifiedAtOf(lifecycle, productionLiveProven);

  const evidence: StudioEvidenceRow[] = [];
  evidence.push({ label: 'Base version', value: concurrency.baseMainSha });
  if (concurrency.draftHeadSha !== undefined) {
    evidence.push({ label: 'Draft version', value: concurrency.draftHeadSha });
  }
  if ('branch' in lifecycle) {
    evidence.push({
      label: 'Studio branch',
      value: lifecycle.branch.name,
      url: lifecycle.branch.url,
    });
  }
  if ('pullRequest' in lifecycle) {
    evidence.push({
      label: 'Draft PR',
      value: `#${lifecycle.pullRequest.number}`,
      url: lifecycle.pullRequest.url,
    });
  }
  if (lifecycle.kind === 'check_failed') {
    evidence.push({
      label: 'Failed check',
      value: lifecycle.failedCheck.name,
      url: lifecycle.failedCheck.url,
    });
  }
  if ('mainSha' in lifecycle) {
    evidence.push({ label: 'Main version', value: lifecycle.mainSha });
  }
  if (lifecycle.kind === 'live') {
    evidence.push({ label: 'Checked version', value: lifecycle.contentVersion });
  }
  if (productionLiveProven && 'productionLive' in lifecycle && lifecycle.productionLive) {
    evidence.push({ label: 'Published version', value: lifecycle.productionLive.mainSha });
  }

  // #117: the two `ready` situations get their own honest copy sets
  // (waiting-to-start vs checks-passed—merging) from the shared mapping.
  const checksPassedMerging = checksPassedOnReady(lifecycle);
  return {
    slug: lifecycle.article.slug,
    title: lifecycle.article.title,
    publishedVersion: {
      label: derivePublishedVersion(lifecycle.kind, lifecycle.article.status, productionLiveProven),
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
    },
    workingChange: { label: deriveWorkingChange(lifecycle) },
    summary: checksPassedMerging
      ? studioChecksPassedMerging().summary
      : SUMMARY_BY_KIND[lifecycle.kind],
    recommendedAction: checksPassedMerging
      ? studioChecksPassedMerging().recommendedAction
      : RECOMMENDED_ACTION_BY_KIND[lifecycle.kind],
    readerEffect: checksPassedMerging
      ? studioChecksPassedMerging().readerEffect
      : READER_EFFECT_BY_KIND[lifecycle.kind],
    validationSummary: deriveValidationSummary(lifecycle),
    actions: actionsForKind(lifecycle.kind),
    concurrency,
    evidence: evidence.slice(0, MAX_EVIDENCE_ROWS),
  };
}

export interface DecodeSuccess<T> {
  ok: true;
  value: T;
}
export interface DecodeFailure {
  ok: false;
  issues: string[];
}
export type DecodeResult<T> = DecodeSuccess<T> | DecodeFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, issues: string[], code: string): void {
  issues.push(`${path}.${code}`);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    issue(path, issues, SAFE_KEY.test(key) ? `unknownKey.${key}` : 'unknownKey');
  }
}

function boundedString(
  value: unknown,
  path: string,
  issues: string[],
  max: number,
  allowEmpty = false,
): string | undefined {
  if (typeof value !== 'string') {
    issue(path, issues, 'string');
    return undefined;
  }
  if (!allowEmpty && value.trim().length === 0) {
    issue(path, issues, 'empty');
    return undefined;
  }
  if (value.length > max) {
    issue(path, issues, 'max');
    return undefined;
  }
  return value;
}

function optionalHttpsUrl(value: unknown, path: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL) {
    issue(path, issues, 'url');
    return undefined;
  }
  if (!HTTPS_PATTERN.test(value) || /\s/.test(value)) {
    issue(path, issues, 'url');
    return undefined;
  }
  return value;
}

function shaLike(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/i.test(value)) {
    issue(path, issues, 'sha');
    return undefined;
  }
  return value;
}

function optionalShaLike(value: unknown, path: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  return shaLike(value, path, issues);
}

function labelValue<Label extends string>(
  value: unknown,
  allowed: readonly Label[],
  path: string,
  issues: string[],
): Label | undefined {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    issue(path, issues, 'label');
    return undefined;
  }
  return value as Label;
}

function actionAvailabilityValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioActionAvailability | undefined {
  if (!isRecord(input)) {
    issue(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['available', 'reason'], path, issues);
  if (issues.length > 0) return undefined;
  if (typeof input.available !== 'boolean') {
    issue(path, issues, 'available');
    return undefined;
  }
  const reason =
    input.reason === undefined
      ? undefined
      : boundedString(input.reason, `${path}.reason`, issues, MAX_LABEL);
  if (issues.length > 0) return undefined;
  return { available: input.available, ...(reason === undefined ? {} : { reason }) };
}

function evidenceRowValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioEvidenceRow | undefined {
  if (!isRecord(input)) {
    issue(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['label', 'value', 'url'], path, issues);
  if (issues.length > 0) return undefined;
  const label = boundedString(input.label, `${path}.label`, issues, MAX_LABEL);
  const value = boundedString(input.value, `${path}.value`, issues, MAX_TEXT);
  const url = optionalHttpsUrl(input.url, `${path}.url`, issues);
  if (issues.length > 0 || label === undefined || value === undefined) return undefined;
  return { label, value, ...(url === undefined ? {} : { url }) };
}

function concurrencyValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioConcurrencyEvidence | undefined {
  if (!isRecord(input)) {
    issue(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(input, ['baseMainSha', 'draftHeadSha', 'expectedBlobSha'], path, issues);
  if (issues.length > 0) return undefined;
  const baseMainSha = shaLike(input.baseMainSha, `${path}.baseMainSha`, issues);
  const draftHeadSha = optionalShaLike(input.draftHeadSha, `${path}.draftHeadSha`, issues);
  const expectedBlobSha = optionalShaLike(input.expectedBlobSha, `${path}.expectedBlobSha`, issues);
  if (issues.length > 0 || baseMainSha === undefined) return undefined;
  return {
    baseMainSha,
    ...(draftHeadSha === undefined ? {} : { draftHeadSha }),
    ...(expectedBlobSha === undefined ? {} : { expectedBlobSha }),
  };
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function decodeStudioWorkspaceProjection(
  input: unknown,
): DecodeResult<StudioWorkspaceProjection> {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ['workspace.object'] };
  rejectUnknownKeys(
    input,
    [
      'slug',
      'title',
      'publishedVersion',
      'workingChange',
      'summary',
      'recommendedAction',
      'readerEffect',
      'validationSummary',
      'actions',
      'concurrency',
      'evidence',
    ],
    'workspace',
    issues,
  );
  if (issues.length > 0) return { ok: false, issues };

  const slug = input.slug;
  if (
    typeof slug !== 'string' ||
    slug.length === 0 ||
    slug.length > 100 ||
    !SLUG_PATTERN.test(slug)
  ) {
    issue('workspace.slug', issues, 'slug');
  }
  const title = boundedString(input.title, 'workspace.title', issues, MAX_LABEL);

  let publishedVersionLabel: StudioPublishedVersionLabel | undefined;
  let publishedVersionVerifiedAt: string | undefined;
  if (!isRecord(input.publishedVersion)) {
    issue('workspace.publishedVersion', issues, 'object');
  } else {
    rejectUnknownKeys(
      input.publishedVersion,
      ['label', 'verifiedAt'],
      'workspace.publishedVersion',
      issues,
    );
    publishedVersionLabel = labelValue(
      input.publishedVersion.label,
      STUDIO_PUBLISHED_VERSION_LABELS,
      'workspace.publishedVersion.label',
      issues,
    );
    publishedVersionVerifiedAt =
      input.publishedVersion.verifiedAt === undefined
        ? undefined
        : boundedString(
            input.publishedVersion.verifiedAt,
            'workspace.publishedVersion.verifiedAt',
            issues,
            MAX_LABEL,
          );
    if (
      publishedVersionVerifiedAt !== undefined &&
      !VERIFIED_AT_PATTERN.test(publishedVersionVerifiedAt)
    ) {
      issue('workspace.publishedVersion.verifiedAt', issues, 'date');
      publishedVersionVerifiedAt = undefined;
    }
  }

  let workingChangeLabel: StudioWorkingChangeLabel | undefined;
  if (!isRecord(input.workingChange)) {
    issue('workspace.workingChange', issues, 'object');
  } else {
    rejectUnknownKeys(input.workingChange, ['label'], 'workspace.workingChange', issues);
    workingChangeLabel = labelValue(
      input.workingChange.label,
      STUDIO_WORKING_CHANGE_LABELS,
      'workspace.workingChange.label',
      issues,
    );
  }

  const summary = boundedString(input.summary, 'workspace.summary', issues, MAX_TEXT);
  const recommendedAction = boundedString(
    input.recommendedAction,
    'workspace.recommendedAction',
    issues,
    MAX_TEXT,
  );
  const readerEffect = boundedString(
    input.readerEffect,
    'workspace.readerEffect',
    issues,
    MAX_TEXT,
  );
  const validationSummary = boundedString(
    input.validationSummary,
    'workspace.validationSummary',
    issues,
    MAX_VALIDATION_SUMMARY,
  );

  let actions: StudioWorkspaceProjection['actions'] | undefined;
  if (!isRecord(input.actions)) {
    issue('workspace.actions', issues, 'object');
  } else {
    const allowedActionKeys = [
      'preview',
      'save',
      'publish',
      'refresh',
      'unpublish',
      'discard',
    ] as const;
    rejectUnknownKeys(input.actions, allowedActionKeys, 'workspace.actions', issues);
    const preview = actionAvailabilityValue(
      input.actions.preview,
      'workspace.actions.preview',
      issues,
    );
    const save = actionAvailabilityValue(input.actions.save, 'workspace.actions.save', issues);
    const publish = actionAvailabilityValue(
      input.actions.publish,
      'workspace.actions.publish',
      issues,
    );
    const refresh = actionAvailabilityValue(
      input.actions.refresh,
      'workspace.actions.refresh',
      issues,
    );
    const unpublish = actionAvailabilityValue(
      input.actions.unpublish,
      'workspace.actions.unpublish',
      issues,
    );
    const discard = actionAvailabilityValue(
      input.actions.discard,
      'workspace.actions.discard',
      issues,
    );
    if (
      preview !== undefined &&
      save !== undefined &&
      publish !== undefined &&
      refresh !== undefined &&
      unpublish !== undefined &&
      discard !== undefined
    ) {
      actions = { preview, save, publish, refresh, unpublish, discard };
    }
  }

  const concurrency = concurrencyValue(input.concurrency, 'workspace.concurrency', issues);

  let evidence: StudioEvidenceRow[] | undefined;
  if (!Array.isArray(input.evidence)) {
    issue('workspace.evidence', issues, 'array');
  } else if (input.evidence.length > MAX_EVIDENCE_ROWS) {
    issue('workspace.evidence', issues, 'max');
  } else {
    const rows: StudioEvidenceRow[] = [];
    let rowsOk = true;
    for (const [index, row] of input.evidence.entries()) {
      const value = evidenceRowValue(row, `workspace.evidence[${index}]`, issues);
      if (value === undefined) {
        rowsOk = false;
        continue;
      }
      rows.push(value);
    }
    if (rowsOk) evidence = rows;
  }

  if (
    issues.length > 0 ||
    typeof slug !== 'string' ||
    title === undefined ||
    publishedVersionLabel === undefined ||
    workingChangeLabel === undefined ||
    summary === undefined ||
    recommendedAction === undefined ||
    readerEffect === undefined ||
    validationSummary === undefined ||
    actions === undefined ||
    concurrency === undefined ||
    evidence === undefined
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      slug,
      title,
      publishedVersion: {
        label: publishedVersionLabel,
        ...(publishedVersionVerifiedAt === undefined
          ? {}
          : { verifiedAt: publishedVersionVerifiedAt }),
      },
      workingChange: { label: workingChangeLabel },
      summary,
      recommendedAction,
      readerEffect,
      validationSummary,
      actions,
      concurrency,
      evidence,
    },
  };
}
