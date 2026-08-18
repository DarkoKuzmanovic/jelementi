import type { StudioEditorInput } from './contracts';
import {
  beginStudioSubmit,
  createStudioSnapshotId,
  createStudioSubmittedSnapshotId,
  initialStudioTransportState,
  isStudioSubmitPending,
  resolveStudioSubmit,
  shouldEnhanceSubmit,
  type StudioSubmitOutcome,
  type StudioTransportState,
} from './enhancement-transport';
import type { StudioRecoveryRecord, StudioRecoveryStore } from './enhancement-recovery';
import { STUDIO_RECOVERY_VERSION } from './enhancement-recovery';

/**
 * Client-safe selective-enhancement controller (#78, slice 4).
 *
 * A small explicit-callback controller that owns the whole enhanced
 * Preview / Save / Check status cycle for ONE form, using only structural
 * browser interfaces so its behavior is unit-testable in Node without a
 * DOM. The page supplies the real DOM objects and callbacks; the controller
 * never derives lifecycle, eligibility, validation truth, or Flowboard
 * assignment (those stay server-authored envelopes).
 *
 * Non-negotiable behavior encoded here (#72 "Selective enhancement and
 * browser-owned state"):
 * - Intercepts ONLY exact allowlisted submitters (Preview/Save on the
 *   editor form, Check on the check forms). Publish, replacement,
 *   Unpublish, Discard, and unknown submitters fall through natively — the
 *   listener never calls preventDefault for them.
 * - The immutable bounded submitted snapshot is captured BEFORE
 *   preventDefault. A malformed/oversized snapshot (capture returns
 *   undefined) falls through to a guarded native `requestSubmit` — never a
 *   recursion into the same listener.
 * - Once fetch starts, a rejection/parse failure is "Completion unknown":
 *   preserve the candidate, never retry automatically, count a transport
 *   failure. Two uncertain outcomes disable enhancement for this form until
 *   navigation/reload; full-page forms remain usable.
 * - An authoritative envelope is applied only when its submitted-snapshot
 *   id still matches the live form (recomputed at response time); newer
 *   typing therefore never gets overwritten by an earlier response.
 * - Routine success announces politely without stealing focus; blocking
 *   errors announce assertively; uncertain completion announces
 *   "Completion unknown" and offers explicit follow-up.
 */

export interface StudioSubmitterLike {
  formAction: string | null;
  disabled: boolean;
}

export interface StudioSubmitEventLike {
  preventDefault(): void;
  defaultPrevented: boolean;
  submitter: StudioSubmitterLike | null;
}

export interface StudioEnhancementFormLike {
  action: string;
  method: string;
  addEventListener(
    type: 'submit',
    listener: (event: StudioSubmitEventLike) => void,
    options?: { once?: boolean },
  ): void;
  removeEventListener(type: 'submit', listener: (event: StudioSubmitEventLike) => void): void;
  requestSubmit(submitter?: StudioSubmitterLike | null): void;
}

export type StudioActionResponseLike =
  | { type: 'success'; data: unknown }
  | { type: 'redirect'; location: string }
  | { type: 'error'; error: unknown };

export interface StudioEnhancementControllerOptions {
  form: StudioEnhancementFormLike;
  enhancedActions: readonly string[];
  /** Captures the immutable bounded snapshot from the live form (may return undefined). */
  captureSnapshot(): StudioEditorInput | undefined;
  /** Builds the enhanced request body, embedding the bounded correlation ids. */
  buildBody(
    snapshot: StudioEditorInput,
    ids: { operationId: string; submittedSnapshotId: string },
  ): FormData;
  /** Parses a SvelteKit action response body (page injects `deserialize` from `$app/forms`). */
  deserialize(text: string): StudioActionResponseLike;
  fetchImpl(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  /** Reads the envelope correlation id from decoded action data; undefined = not an envelope. */
  envelopeCorrelation(data: unknown): { submittedSnapshotId: string } | undefined;
  /** Applies a decoded authoritative envelope to targeted result regions only. */
  applyEnvelope(data: unknown, liveMatchesSubmitted: boolean): void;
  /** Recomputed snapshot id of the CURRENT live form (to detect newer typing). */
  liveSnapshotId(): string;
  announcePolite(message: string): void;
  announceAssertive(message: string): void;
  onPendingChanged(pending: boolean): void;
  onCompletionUnknown(): void;
  onRedirect(location: string): void;
  onStateChanged(state: StudioTransportState): void;
}

export interface StudioEnhancementController {
  readonly state: StudioTransportState;
  install(): void;
  destroy(): void;
}

/**
 * Whether the server's echoed submitted-snapshot id still matches the live
 * form. Newer typing produces a different recomputed id, so an earlier
 * response is never applied over it (#78 snapshot reconciliation).
 */
export function studioSnapshotMatchesLive(
  submittedSnapshotId: string,
  live: StudioEditorInput,
): boolean {
  return createStudioSubmittedSnapshotId(live) === submittedSnapshotId;
}

export function createStudioEnhancementController(
  options: StudioEnhancementControllerOptions,
): StudioEnhancementController {
  let state = initialStudioTransportState();

  /** Normalizes a form/submitter action to just its `?/action` search string. */
  const normalizeAction = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.length === 0) return null;
    try {
      const search = new URL(value, 'https://studio.invalid/').search;
      // An empty search means the value carries no named-action marker.
      // Engine `formAction` getters strip the `?/action` query when a
      // button has no `formaction`, so the caller must fall back to the
      // form's own action in that case (#78).
      return search.length === 0 ? null : search;
    } catch {
      return null;
    }
  };

  const submitterAction = (event: StudioSubmitEventLike): string | null => {
    if (event.submitter === null) return null;
    // Prefer the clicked submitter's own action (its `formaction`, or the
    // resolved form action), then fall back to the form's action. Buttons
    // without a `formaction` can report an empty/unreliable `formAction` in
    // some engines, so the form action keeps exact-action interception
    // working for Preview and the check forms (#78).
    return normalizeAction(event.submitter?.formAction) ?? normalizeAction(options.form.action);
  };

  const handleSubmit = (event: StudioSubmitEventLike): void => {
    const action = submitterAction(event);
    if (action === null || !shouldEnhanceSubmit(action, options.enhancedActions)) return; // native
    if (state.disabled || isStudioSubmitPending(state)) return; // native

    // Capture the immutable bounded snapshot BEFORE preventDefault. A
    // malformed form falls through to native submission — never enhance a
    // form we cannot bound.
    let snapshot: StudioEditorInput | undefined;
    try {
      snapshot = options.captureSnapshot();
    } catch {
      snapshot = undefined;
    }
    if (snapshot === undefined) {
      state = resolveStudioSubmit(state, 'before-send');
      options.onStateChanged(state);
      return; // original event remains unprevented: one native submission
    }

    const submittedSnapshotId = createStudioSubmittedSnapshotId(snapshot);
    const operationId = createStudioSnapshotId();
    let body: FormData;
    try {
      body = options.buildBody(snapshot, { operationId, submittedSnapshotId });
    } catch {
      state = resolveStudioSubmit(state, 'before-send');
      options.onStateChanged(state);
      return; // setup failed before send; preserve native submission
    }

    event.preventDefault();
    state = beginStudioSubmit(state);
    options.onStateChanged(state);
    options.onPendingChanged(true);
    options.announcePolite('Submitting…');
    void submit(action, body, submittedSnapshotId);
  };

  const submit = async (
    action: string,
    body: FormData,
    submittedSnapshotId: string,
  ): Promise<void> => {
    let outcome: StudioSubmitOutcome = 'success';
    try {
      const response = await options.fetchImpl(action, {
        method: options.form.method.toUpperCase(),
        body,
        cache: 'no-store',
        headers: { Accept: 'application/json', 'x-sveltekit-action': 'true' },
      });
      const parsed = options.deserialize(await response.text());
      if (parsed.type === 'redirect') {
        options.onRedirect(parsed.location);
      } else if (parsed.type === 'error') {
        // Authoritative server rejection — the request completed; never
        // retry, never count a transport failure.
        options.announceAssertive('The server rejected the submission. Nothing was changed.');
      } else if (parsed.type === 'success') {
        const correlation = options.envelopeCorrelation(parsed.data);
        if (correlation !== undefined && correlation.submittedSnapshotId === submittedSnapshotId) {
          const liveMatchesSubmitted = options.liveSnapshotId() === submittedSnapshotId;
          // The callback may update only authoritative result regions. It
          // receives the match bit so Save can clear only its exact recovery
          // snapshot; newer form values are never replaced.
          options.applyEnvelope(parsed.data, liveMatchesSubmitted);
          options.announcePolite(
            liveMatchesSubmitted ? 'Updated.' : 'Updated — your newer typing was kept.',
          );
        }
      }
    } catch {
      // Once the request may have been sent, failure means completion is
      // unknown: preserve the candidate, never retry automatically.
      outcome = 'uncertain';
      options.onCompletionUnknown();
    } finally {
      state = resolveStudioSubmit(state, outcome);
      options.onStateChanged(state);
      options.onPendingChanged(false);
    }
  };

  const listener = (event: StudioSubmitEventLike): void => handleSubmit(event);

  return {
    get state() {
      return state;
    },
    install() {
      options.form.addEventListener('submit', listener);
    },
    destroy() {
      options.form.removeEventListener('submit', listener);
    },
  };
}

/**
 * Recovery-copy tracker (#78): debounced (300ms) record writes plus an
 * explicit flush for `pagehide`, a clear for explicit abandonment, and a
 * stop for teardown. Storage failure is non-fatal — the tracker disables
 * only the recovery convenience and reports it once through
 * `onUnavailable`.
 */
export interface StudioRecoveryTrackerOptions {
  store: StudioRecoveryStore;
  key: string;
  debounceMs?: number;
  now?: () => string;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  onUnavailable?: () => void;
  /** Fired with the record actually written (after the debounce). */
  onWrite?: (record: StudioRecoveryRecord) => void;
}

export interface StudioRecoveryTracker {
  readonly available: boolean;
  track(candidate: StudioEditorInput | undefined): void;
  flush(): void;
  clear(): void;
  stop(): void;
}

export function createStudioRecoveryTracker(
  options: StudioRecoveryTrackerOptions,
): StudioRecoveryTracker {
  const debounceMs = options.debounceMs ?? 300;
  const now = options.now ?? (() => new Date().toISOString());
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastCandidate: StudioEditorInput | undefined;
  let available = options.store.available;
  // Report unavailability once, whenever it is first observed — including a
  // store already unavailable at construction (flush/track still surface
  // the visible copy through onUnavailable).
  let unavailableReported = false;

  const reportUnavailable = (): void => {
    available = false;
    if (!unavailableReported) {
      unavailableReported = true;
      options.onUnavailable?.();
    }
  };

  const write = (candidate: StudioEditorInput): void => {
    if (!available) {
      reportUnavailable();
      return;
    }
    const record: StudioRecoveryRecord = {
      version: STUDIO_RECOVERY_VERSION,
      candidate,
      loadedConcurrency: candidate.concurrency,
      capturedAt: now(),
    };
    const wrote = options.store.write(options.key, record);
    if (!wrote) {
      reportUnavailable();
      return;
    }
    options.onWrite?.(record);
  };

  return {
    get available() {
      return available;
    },
    track(candidate) {
      lastCandidate = candidate;
      if (candidate === undefined) return;
      if (timer !== undefined) clearTimeoutFn(timer);
      timer = setTimeoutFn(() => {
        timer = undefined;
        write(candidate);
      }, debounceMs);
    },
    flush() {
      if (timer !== undefined) {
        clearTimeoutFn(timer);
        timer = undefined;
      }
      if (lastCandidate !== undefined) write(lastCandidate);
    },
    clear() {
      if (timer !== undefined) {
        clearTimeoutFn(timer);
        timer = undefined;
      }
      lastCandidate = undefined;
      options.store.clear(options.key);
    },
    stop() {
      if (timer !== undefined) {
        clearTimeoutFn(timer);
        timer = undefined;
      }
    },
  };
}
