/**
 * Selective-enhancement transport coordinator (#78).
 *
 * Pure, client-safe state machine for the enhanced Preview / Save / Check
 * status submissions. It owns ONLY transport/presentation concerns:
 * which submitters may be intercepted, the pending lock, the consecutive
 * transport-failure counter, and the per-form disable decision. It never
 * derives lifecycle, eligibility, validation truth, or Flowboard
 * assignment — those stay server-authored.
 *
 * Contract (#72 "Selective enhancement and browser-owned state"):
 * - Preview, Save draft, and Check status may submit through their exact
 *   existing server actions; everything else (Publish, replacement,
 *   Unpublish, Discard, unknown submitters) falls through to native
 *   full-navigation submission.
 * - Failure before the request is sent falls through to ordinary form
 *   submission. Completion uncertainty after send preserves the candidate,
 *   performs no automatic retry, and the UI offers explicit follow-up.
 * - Two transport failures for one form disable enhancement for that form
 *   until navigation/reload while full-page forms remain usable.
 */

import type { StudioEditorInput } from './contracts';

export const STUDIO_EDITOR_ENHANCED_ACTIONS = ['?/preview', '?/save'] as const;
export const STUDIO_CHECK_ENHANCED_ACTIONS = ['?/refresh', '?/check'] as const;
export const STUDIO_TRANSPORT_DISABLE_THRESHOLD = 2;

/** Exact-submitter allowlist — a blanket enhancer must never capture others. */
export function shouldEnhanceSubmit(
  action: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  return typeof action === 'string' && (allowlist as readonly string[]).includes(action);
}

export interface StudioTransportState {
  pending: boolean;
  consecutiveFailures: number;
  /** Sticky once true: enhancement stays off for this form until reload. */
  disabled: boolean;
}

export function initialStudioTransportState(): StudioTransportState {
  return { pending: false, consecutiveFailures: 0, disabled: false };
}

export function beginStudioSubmit(state: StudioTransportState): StudioTransportState {
  return { ...state, pending: true };
}

export type StudioSubmitOutcome = 'success' | 'uncertain' | 'before-send';

/**
 * Resolves a completed enhanced submission. `before-send` failures are not
 * counted (the request never left the browser and the form falls through to
 * native submission). `uncertain` counts a transport failure and may
 * disable the form. `success` resets the failure counter but never re-enables
 * a form already disabled for the session.
 */
export function resolveStudioSubmit(
  state: StudioTransportState,
  outcome: StudioSubmitOutcome,
): StudioTransportState {
  if (outcome === 'before-send') {
    return { ...state, pending: false };
  }
  if (outcome === 'success') {
    return { pending: false, consecutiveFailures: 0, disabled: state.disabled };
  }
  const consecutiveFailures = state.consecutiveFailures + 1;
  return {
    pending: false,
    consecutiveFailures,
    disabled: consecutiveFailures >= STUDIO_TRANSPORT_DISABLE_THRESHOLD,
  };
}

export interface StudioPendingLock {
  action: string;
  snapshotId: string;
}

/** True while an enhanced submission for this form is in flight. */
export function isStudioSubmitPending(state: StudioTransportState): boolean {
  return state.pending;
}

/**
 * Bounded client-authored operation/snapshot id, matching the envelope id
 * grammar (`/^[A-Za-z0-9._-]{1,200}$/`). The server bounds and echoes it;
 * it is a correlation token, never authority.
 */
export function createStudioSnapshotId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const bounded = random.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
  return bounded.length === 0 ? `snapshot-${Date.now()}` : bounded;
}

/**
 * Deterministic, content-derived submitted-snapshot id (#78 snapshot
 * reconciliation). Unlike the operation id, this MUST be recomputable from
 * the current live form: the enhanced client regenerates it after a
 * response and only updates concurrency/evidence regions when it still
 * equals the id the server echoed — newer typing therefore never matches
 * and is never overwritten. Bounded to the envelope id grammar; the server
 * never trusts it (correlation only). The input is the DECODED
 * `StudioEditorInput`, whose key order is canonical, so the fingerprint is
 * stable across captures of identical content.
 */
export function createStudioSubmittedSnapshotId(candidate: StudioEditorInput): string {
  const json = JSON.stringify(candidate);
  let hash = 5381;
  for (let index = 0; index < json.length; index += 1) {
    hash = ((hash << 5) + hash + json.charCodeAt(index)) >>> 0;
  }
  const id = `snapshot-${hash.toString(16)}`;
  return id.length <= 200 ? id : id.slice(0, 200);
}
