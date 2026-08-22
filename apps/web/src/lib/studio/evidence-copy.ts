/**
 * Humanized evidence copy for Studio operational surfaces (#117).
 *
 * Single presentation seam for the two things #117 demands of every
 * writer-facing string: digests are shown SHORT (≤7 characters, labeled in
 * plain language — full values stay behind the Evidence disclosure), and
 * internal phase/reason identifiers are never echoed verbatim — every
 * stopped operation gets a sentence-form explanation naming what happened.
 *
 * Presentation only: nothing here derives lifecycle truth, mutates
 * detection semantics, or touches evidence collection. Malformed input
 * degrades to a shorter sentence or an empty digest — never an invented
 * value and never a thrown error (mirrors the never-throwing style of
 * `contracts.ts`).
 */

import type { StudioCheckEvidence } from './contracts';

export const STUDIO_SHA_SHORT_LENGTH = 7;

const SHA_LIKE = /^[0-9a-f]{40,64}$/i;

/**
 * Abbreviated lowercase digest for operational copy: at most
 * `STUDIO_SHA_SHORT_LENGTH` characters. Absent or malformed input yields ''
 * — the UI then shows the bare label instead of an invented digest.
 */
export function shortStudioSha(sha: string | undefined): string {
  if (sha === undefined || !SHA_LIKE.test(sha)) return '';
  return sha.slice(0, STUDIO_SHA_SHORT_LENGTH).toLowerCase();
}

// === Phase → plain-language mapping tables (#117) ===
//
// Every entry is a self-contained clause ending without terminal
// punctuation so callers compose sentences; composed copy always ends with
// a period. No entry contains its own key or any other internal code.

type SaveFailurePhase = 'main' | 'branch' | 'commit' | 'pull-request';

const SAVE_PHASE_COPY: Readonly<Record<SaveFailurePhase, string>> = {
  main: 'GitHub could not be reached while reading the published history this save builds on',
  branch: "GitHub could not be reached while preparing this article's draft branch",
  commit: 'GitHub could not be reached while writing your draft commit',
  'pull-request': 'GitHub could not be reached while opening the Draft PR',
};

/** Sentence explaining where a save stopped, never echoing the phase code. */
export function saveStoppedCopy(phase: string): string {
  const known = SAVE_PHASE_COPY[phase as SaveFailurePhase];
  return `${known ?? 'GitHub could not be reached while saving'} — nothing was changed.`;
}

type PublishPhase =
  'branch' | 'revalidate' | 'status-flip' | 'pull-request' | 'ready' | 'auto-merge';
type PublishReason = 'github' | 'topology' | 'transform';

const PUBLISH_PHASE_COPY: Readonly<Record<PublishPhase, string>> = {
  branch: 'the draft branch could not be located on GitHub',
  revalidate: 'the committed draft could not be revalidated against fresh GitHub state',
  'status-flip': "the draft's publishing status could not be updated",
  'pull-request': 'the Draft PR could not be updated on GitHub',
  ready: 'the Draft PR was being marked ready for review',
  'auto-merge': 'automatic merging was being enabled on the Draft PR',
};

const PUBLISH_REASON_COPY: Readonly<Record<PublishReason, string>> = {
  github: 'GitHub could not be reached',
  topology: 'the Draft PR setup is not the single-draft shape Studio expects',
  transform: 'the frontmatter status line could not be rewritten unambiguously',
};

function publishPhaseCopy(phase: string): string {
  return (
    PUBLISH_PHASE_COPY[phase as PublishPhase] ?? 'the next publishing step could not be completed'
  );
}

function publishReasonCopy(reason: string): string {
  return PUBLISH_REASON_COPY[reason as PublishReason] ?? 'the operation was stopped safely';
}

/**
 * Sentence explaining where and why a publish stopped, without raw codes.
 */
export function publishStoppedCopy(phase: string, reason: string): string {
  return `Publishing stopped before it completed: ${publishPhaseCopy(phase)}, because ${publishReasonCopy(reason)}.`;
}

type ReplacementPhase =
  | 'decode-request'
  | 'discover-main'
  | 'discover-branch'
  | 'verify-loaded-head'
  | 'verify-target'
  | 'verify-diff'
  | 'discover-pull-request'
  | 'close-pull-request'
  | 'confirm-pull-request'
  | 'delete-branch'
  | 'recreate-branch'
  | 'commit-candidate'
  | 'create-pull-request'
  | 'confirm-replacement'
  | 'revalidate';

const REPLACEMENT_PHASE_COPY: Readonly<Record<ReplacementPhase, string>> = {
  'decode-request': 'your submitted text could not be read back safely',
  'discover-main': 'the current state of main could not be read from GitHub',
  'discover-branch': "this article's Studio draft branch could not be examined on GitHub",
  'verify-loaded-head': 'the saved draft head was being verified against GitHub',
  'verify-target': 'the published article was being compared with what you loaded',
  'verify-diff': 'the draft branch contents were being compared with your submitted text',
  'discover-pull-request': "this article's Draft PR could not be found on GitHub",
  'close-pull-request': 'the stale Draft PR was being closed on GitHub',
  'confirm-pull-request': 'the stale Draft PR closure was being confirmed on GitHub',
  'delete-branch': 'the old draft branch was being deleted on GitHub',
  'recreate-branch': 'a fresh draft branch was being created from current main',
  'commit-candidate': 'your submitted text was being committed to the fresh draft branch',
  'create-pull-request': 'a new Draft PR was being opened on GitHub',
  'confirm-replacement': 'the finished replacement was being confirmed on GitHub',
  revalidate: 'your submitted text was being validated before anything was written',
};

const REPLACEMENT_REASON_COPY: Readonly<
  Record<'not-eligible' | 'moved-head' | 'merged' | 'topology' | 'github' | 'validation', string>
> = {
  'not-eligible':
    'the article on fresh main no longer matches what this editor loaded, so replacing could overwrite a newer change',
  'moved-head':
    'the draft branch moved after this editor loaded, so replacing would discard newer commits',
  merged: 'the Draft PR was already merged, so there is no stale draft left to replace',
  topology: "this article's pull-request setup is ambiguous and needs manual review",
  github: 'GitHub could not be reached',
  validation: 'your submitted text did not pass validation',
};

function replacementPhaseCopy(phase: string): string {
  return (
    REPLACEMENT_PHASE_COPY[phase as ReplacementPhase] ??
    'the replacement step could not be completed'
  );
}

function replacementReasonCopy(reason: string): string {
  return (
    REPLACEMENT_REASON_COPY[reason as keyof typeof REPLACEMENT_REASON_COPY] ??
    'the operation was stopped safely'
  );
}

/**
 * Sentence explaining where and why a replacement stopped, without raw
 * codes. Covers both conflict (`replacement_conflict`) and failure
 * (`replacement_failed`) reasons.
 */
export function replacementStoppedCopy(phase: string, reason: string): string {
  return `The replacement stopped while ${replacementPhaseCopy(phase)} — ${replacementReasonCopy(reason)}.`;
}

/**
 * Sentence for the lifecycle `failed` kind ("status unavailable"): explains
 * that the status could not be determined without echoing internal phase or
 * category codes, and points at the one deterministic remedy.
 */
export function statusUnavailableCopy(): string {
  return 'Status could not be determined because reading the current state failed; check status again.';
}

type UnpublishPhase =
  | 'main'
  | 'canonical'
  | 'branch'
  | 'commit'
  | 'revalidate'
  | 'pull-request'
  | 'ready'
  | 'auto-merge';

const UNPUBLISH_PHASE_COPY: Readonly<Record<UnpublishPhase, string>> = {
  main: 'reading the published history',
  canonical: 'reading the archived article file',
  branch: "updating this article's Studio branch",
  commit: 'writing the archive commit',
  revalidate: 'validating the archive change',
  'pull-request': 'opening the archive Draft PR',
  ready: 'the archive Draft PR was being marked ready',
  'auto-merge': 'automatic merging was being enabled on the archive Draft PR',
};

/** Sentence explaining where an unpublish stopped, without raw codes. */
export function unpublishStoppedCopy(phase: string): string {
  const known = UNPUBLISH_PHASE_COPY[phase as UnpublishPhase];
  return `GitHub could not be reached while ${known ?? 'finishing the removal'}.`;
}

type DiscardPhase = 'branch' | 'pull-request' | 'close-pull-request' | 'delete-branch';

const DISCARD_PHASE_COPY: Readonly<Record<DiscardPhase, string>> = {
  branch: "locating this article's draft branch",
  'pull-request': "examining this article's Draft PR",
  'close-pull-request': 'closing the Draft PR',
  'delete-branch': 'deleting the draft branch',
};

/** Sentence explaining where a discard stopped, without raw codes. */
export function discardStoppedCopy(phase: string): string {
  const known = DISCARD_PHASE_COPY[phase as DiscardPhase];
  return `GitHub could not be reached while ${known ?? 'discarding the draft'}.`;
}

// === Checks-passed versus waiting-for-checks (#117) ===

/**
 * Shared #117 predicate: true only when a check run was actually observed,
 * COMPLETED, and concluded successfully. Anything else — no run yet,
 * queued/running, any non-success conclusion — stays honestly in its
 * waiting/running state. One seam for the article page, the flowboard, and
 * the publish panel.
 */
export function isConcludedSuccessfulCheck(check: StudioCheckEvidence | undefined): boolean {
  return check !== undefined && check.status === 'completed' && check.conclusion === 'success';
}

export const STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING = 'Checks passed — merging' as const;
/** Existing waiting-to-start label; single source for every surface that renders it. */
export const STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS = 'Approved — waiting for checks' as const;

/**
 * Copy set for the ready-with-successful-check situation: the required
 * check has already concluded successfully but the merge has not fired yet.
 * Factually distinct from waiting-to-start — and it must never invite a
 * duplicate Publish.
 */
export function studioChecksPassedMerging(): {
  label: typeof STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING;
  summary: string;
  recommendedAction: string;
  readerEffect: string;
} {
  return {
    label: STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING,
    summary: 'The required check has passed; GitHub is merging this change automatically.',
    recommendedAction:
      'Nothing to do — wait for the merge to finish, or check status again shortly.',
    readerEffect: 'Readers will see this change once the automatic merge and site update finish.',
  };
}

// === Flowboard status-observation failures (#117) ===
//
// The list projection's `failure` evidence carries internal phase/reason
// codes ('check' + 'github'); the card renders them as a human sentence.

type ObservationPhase = 'branch' | 'pull-request' | 'check' | 'compile';

const OBSERVATION_PHASE_COPY: Readonly<Record<ObservationPhase, string>> = {
  branch: "reading this article's Studio branch",
  'pull-request': "reading this article's Draft PR",
  check: 'reading the required verification',
  compile: 'validating the saved draft text',
};

const OBSERVATION_REASON_COPY: Readonly<Record<'github' | 'topology' | 'validation', string>> = {
  github: 'GitHub could not be reached',
  topology: "this article's Studio setup on GitHub needs manual review",
  validation: 'the saved draft text could not be validated',
};

/**
 * Sentence explaining why an article's latest status observation could not
 * be completed, without echoing the internal phase or reason codes.
 */
export function statusObservationCopy(phase: string, reason: string): string {
  const phaseClause =
    OBSERVATION_PHASE_COPY[phase as ObservationPhase] ?? 'reading the current state';
  const reasonClause = OBSERVATION_REASON_COPY[reason as keyof typeof OBSERVATION_REASON_COPY] as
    string | undefined;
  return `The latest status observation stopped while ${phaseClause} because ${
    reasonClause ?? 'the attempt was stopped safely'
  }.`;
}
