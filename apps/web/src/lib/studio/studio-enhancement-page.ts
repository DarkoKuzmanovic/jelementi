/**
 * Page wiring for #78 selective enhancement (browser-only).
 *
 * Thin glue between the real DOM, the pure controller/transport/recovery
 * modules, and the strict envelope decoders. Every authority decision stays
 * server-authored: the browser only intercepts exact allowlisted submitters,
 * decodes server-built envelopes, and updates targeted result regions.
 *
 * The controller (`studio-enhancement-controller.ts`) stays untouched and
 * unit-tested; this module composes it with DOM elements. Publish,
 * replacement, Unpublish, and Discard submitters are never intercepted (the
 * controller's allowlist), and no blanket `use:enhance` is used anywhere.
 */

import type { StudioConcurrencyEvidence, StudioEditorInput } from './contracts';
import { captureStudioSubmittedSnapshot, type StudioRecoveryRecord } from './enhancement-recovery';
import {
  createStudioSnapshotId,
  createStudioSubmittedSnapshotId,
  STUDIO_CHECK_ENHANCED_ACTIONS,
  STUDIO_EDITOR_ENHANCED_ACTIONS,
  type StudioTransportState,
} from './enhancement-transport';
import {
  createStudioEnhancementController,
  type StudioActionResponseLike,
  type StudioEnhancementControllerOptions,
} from './studio-enhancement-controller';
import { decodeStudioActionEnvelope, type StudioActionEnvelope } from './action-envelope';
import {
  decodeStudioFlowboardCheckEnvelope,
  type StudioFlowboardCheckEnvelope,
} from './flowboard-envelope';

/** SvelteKit action data always nests the envelope under its own key. */
function envelopeFromActionData(
  data: unknown,
):
  | { kind: 'action'; envelope: StudioActionEnvelope }
  | { kind: 'flowboard'; envelope: StudioFlowboardCheckEnvelope }
  | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  const action = decodeStudioActionEnvelope(record.envelope);
  if (action.ok) return { kind: 'action', envelope: action.value };
  const flowboard = decodeStudioFlowboardCheckEnvelope(record.envelope);
  if (flowboard.ok) return { kind: 'flowboard', envelope: flowboard.value };
  return undefined;
}

function envelopeCorrelationFromData(data: unknown): { submittedSnapshotId: string } | undefined {
  const envelope = envelopeFromActionData(data);
  return envelope === undefined
    ? undefined
    : { submittedSnapshotId: envelope.envelope.submittedSnapshotId };
}

export interface StudioRawActionResponse {
  type: string;
  status?: number;
  data?: unknown;
  location?: string;
  error?: unknown;
}

/** Normalizes SvelteKit's `deserialize` union into the controller's shape. */
export function toStudioActionResponse(raw: StudioRawActionResponse): StudioActionResponseLike {
  if (raw.type === 'redirect' && typeof raw.location === 'string') {
    return { type: 'redirect', location: raw.location };
  }
  if (raw.type === 'error') return { type: 'error', error: raw.error };
  if ((raw.type === 'success' || raw.type === 'failure') && 'data' in raw) {
    return { type: 'success', data: raw.data };
  }
  return { type: 'error', error: raw };
}

export interface StudioEnhancementCallbacks {
  deserialize(text: string): StudioActionResponseLike;
  announcePolite(message: string): void;
  announceAssertive(message: string): void;
  onPendingChanged?(pending: boolean): void;
  onCompletionUnknown(): void;
  onStateChanged(state: StudioTransportState): void;
  onRedirect(location: string): void;
  /** Editor/check actions: envelope, the full action data, and live-match bit. */
  onActionEnvelope(envelope: StudioActionEnvelope, data: unknown, liveMatches: boolean): void;
  onFlowboardEnvelope?(envelope: StudioFlowboardCheckEnvelope): void;
}

/** Captures the live editor form as a bounded immutable candidate. */
export function captureLiveEditorCandidate(form: HTMLFormElement): StudioEditorInput | undefined {
  return captureStudioSubmittedSnapshot(new FormData(form));
}

/** Id that can never equal a real submitted-snapshot id (capture failed). */
export const UNMATCHED_SNAPSHOT_ID = '__studio-unmatched-snapshot__';

/**
 * Recomputes the CURRENT live form's snapshot id. Newer typing yields a
 * different id, so an earlier authoritative response is never applied over
 * it; a form that cannot be bounded yields a sentinel that never matches.
 */
export function liveSnapshotIdOf(form: HTMLFormElement): string {
  const candidate = captureStudioSubmittedSnapshot(new FormData(form));
  return candidate === undefined
    ? UNMATCHED_SNAPSHOT_ID
    : createStudioSubmittedSnapshotId(candidate);
}

function syntheticCheckCandidate(slug: string): StudioEditorInput {
  return {
    metadata: {
      title: slug,
      slug,
      excerpt: '',
      status: 'draft',
      updatedAt: '',
      category: '',
      tags: [],
      author: '',
      cover: { src: '', alt: '' },
      references: [],
    },
    body: '',
    concurrency: { baseMainSha: '' },
  };
}

/**
 * Structural adapter from a real DOM form to the controller's form
 * interface. The controller never calls `requestSubmit` (native fallback is
 * the browser's own submission), but the interface requires it; a real
 * submitter button is passed through when it is a button.
 */
function formLikeOf(form: HTMLFormElement): StudioEnhancementControllerOptions['form'] {
  return {
    action: form.action,
    method: form.method,
    addEventListener: (type, listener, options) => {
      form.addEventListener(type, listener as unknown as EventListener, options);
    },
    removeEventListener: (type, listener) => {
      form.removeEventListener(type, listener as unknown as EventListener);
    },
    requestSubmit: (submitter) => {
      if (submitter instanceof HTMLButtonElement) form.requestSubmit(submitter);
      else form.requestSubmit();
    },
  };
}

/**
 * Options for the editor form (Preview / Save draft). The submitted
 * snapshot is the immutable decoded candidate; the request body is the live
 * form plus bounded correlation ids.
 */
export function buildEditorControllerOptions(
  form: HTMLFormElement,
  callbacks: StudioEnhancementCallbacks,
): StudioEnhancementControllerOptions {
  return {
    form: formLikeOf(form),
    enhancedActions: STUDIO_EDITOR_ENHANCED_ACTIONS,
    captureSnapshot: () => captureLiveEditorCandidate(form),
    buildBody: (_snapshot, ids) => {
      const body = new FormData(form);
      body.set('enhancementOperationId', ids.operationId);
      body.set('submittedSnapshotId', ids.submittedSnapshotId);
      return body;
    },
    deserialize: callbacks.deserialize,
    fetchImpl: (input, init) => fetch(input, init),
    envelopeCorrelation: (data) => envelopeCorrelationFromData(data),
    applyEnvelope: (data, liveMatches) => applyEnvelopeFromData(data, liveMatches, callbacks),
    liveSnapshotId: () => liveSnapshotIdOf(form),
    announcePolite: callbacks.announcePolite,
    announceAssertive: callbacks.announceAssertive,
    onPendingChanged: () => {
      /* composed by installStudioEnhancement */
    },
    onCompletionUnknown: callbacks.onCompletionUnknown,
    onRedirect: callbacks.onRedirect,
    onStateChanged: callbacks.onStateChanged,
  };
}

/**
 * Options for a Check status form (Flowboard card `?/check`, article
 * `?/refresh`). There is no editor typing to protect, so the snapshot is a
 * stable synthetic candidate and the live id always matches.
 */
export function buildCheckControllerOptions(
  form: HTMLFormElement,
  slug: string,
  callbacks: StudioEnhancementCallbacks,
): StudioEnhancementControllerOptions {
  const synthetic = syntheticCheckCandidate(slug);
  return {
    form: formLikeOf(form),
    enhancedActions: STUDIO_CHECK_ENHANCED_ACTIONS,
    captureSnapshot: () => synthetic,
    buildBody: (_snapshot, ids) => {
      const body = new FormData(form);
      body.set('enhancementOperationId', ids.operationId);
      body.set('submittedSnapshotId', ids.submittedSnapshotId);
      return body;
    },
    deserialize: callbacks.deserialize,
    fetchImpl: (input, init) => fetch(input, init),
    envelopeCorrelation: (data) => envelopeCorrelationFromData(data),
    applyEnvelope: (data, liveMatches) => applyEnvelopeFromData(data, liveMatches, callbacks),
    liveSnapshotId: () => createStudioSubmittedSnapshotId(synthetic),
    announcePolite: callbacks.announcePolite,
    announceAssertive: callbacks.announceAssertive,
    onPendingChanged: () => {
      /* composed by installStudioEnhancement */
    },
    onCompletionUnknown: callbacks.onCompletionUnknown,
    onRedirect: callbacks.onRedirect,
    onStateChanged: callbacks.onStateChanged,
  };
}

function applyEnvelopeFromData(
  data: unknown,
  liveMatches: boolean,
  callbacks: StudioEnhancementCallbacks,
): void {
  const envelope = envelopeFromActionData(data);
  if (envelope === undefined) return;
  if (envelope.kind === 'flowboard') {
    callbacks.onFlowboardEnvelope?.(envelope.envelope);
    return;
  }
  callbacks.onActionEnvelope(envelope.envelope, data, liveMatches);
}

const CONFLICTING_LIFECYCLE_ACTIONS = ['?/publish', '?/refresh', '?/check', '?/replace'] as const;
const pendingDisabled = new WeakMap<HTMLButtonElement, boolean>();
const pendingFocus = new WeakMap<HTMLFormElement, HTMLElement>();

function formActionOf(button: HTMLButtonElement): string | null {
  const raw = button.getAttribute('formaction') ?? button.form?.getAttribute('action') ?? null;
  if (raw === null) return null;
  try {
    return new URL(raw, document.baseURI).search;
  } catch {
    return null;
  }
}

function collectSubmitters(form: HTMLFormElement): HTMLButtonElement[] {
  const own = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
  const external = form.id
    ? Array.from(document.querySelectorAll<HTMLButtonElement>(`button[form="${form.id}"]`))
    : [];
  return [...own, ...external];
}

/**
 * While an enhanced submission is pending, disable ONLY the submitted
 * button and conflicting lifecycle submitters (Publish, Check status,
 * Replace) of this form. Editing controls are never touched; on completion
 * every disabled state is restored.
 */
export function syncPendingControls(
  form: HTMLFormElement,
  activeAction: string | null,
  pending: boolean,
): void {
  if (pending && document.activeElement instanceof HTMLElement) {
    pendingFocus.set(form, document.activeElement);
  }

  for (const button of collectSubmitters(form)) {
    if (!pending) {
      if (pendingDisabled.has(button)) {
        button.disabled = pendingDisabled.get(button) ?? false;
        pendingDisabled.delete(button);
      }
      continue;
    }
    const action = formActionOf(button);
    const conflicts =
      action !== null &&
      (action === activeAction ||
        (CONFLICTING_LIFECYCLE_ACTIONS as readonly string[]).includes(action));
    if (conflicts && !pendingDisabled.has(button)) {
      pendingDisabled.set(button, button.disabled);
      button.disabled = true;
    }
  }

  if (!pending) {
    const previousFocus = pendingFocus.get(form);
    pendingFocus.delete(form);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}

/**
 * Installs the enhancement controller on a real form, tracking the exact
 * submitter action so pending locking targets the submitted button.
 */
export function installStudioEnhancement(
  form: HTMLFormElement,
  options: StudioEnhancementControllerOptions,
  callbacks: { onPendingChanged?: (pending: boolean) => void },
): { destroy(): void } {
  // Hydration marker (#78): set once whenever a hydrated Studio route
  // installs enhancement. Late SvelteKit hydration re-binds server-bound
  // control values, which can wipe early typing; acceptance helpers wait
  // for this marker before driving form controls. Every hydrated Studio
  // route installs at least one enhancement, so this fires exactly on
  // hydration — and never on non-hydrated routes. Production code does
  // not branch on it.
  if (document.documentElement.dataset.studioHydrated !== 'true') {
    document.documentElement.dataset.studioHydrated = 'true';
  }
  let lastAction: string | null = null;
  const track = (event: Event): void => {
    const submitter = (event as SubmitEvent).submitter;
    lastAction = submitter instanceof HTMLButtonElement ? formActionOf(submitter) : null;
  };
  form.addEventListener('submit', track);
  const controller = createStudioEnhancementController({
    ...options,
    onPendingChanged: (pending) => {
      syncPendingControls(form, lastAction, pending);
      callbacks.onPendingChanged?.(pending);
    },
  });
  controller.install();
  return {
    destroy() {
      form.removeEventListener('submit', track);
      controller.destroy();
    },
  };
}

function setNamedValue(form: HTMLFormElement, name: string, value: string): void {
  const control = form.elements.namedItem(name);
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
  ) {
    if (control.value !== value) {
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function setInputValue(input: HTMLInputElement, value: string): void {
  if (input.value !== value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Explicit browser-only restoration of a Recovery candidate into the native
 * form controls (never auto-applied by the page — always behind a button).
 * Only candidate fields are restored: fresh server concurrency evidence is
 * deliberately left untouched. Input/change events let the recovery tracker
 * observe the restored candidate.
 */
export function restoreCandidateToForm(
  form: HTMLFormElement,
  candidate: StudioRecoveryRecord['candidate'],
): void {
  const metadata = candidate.metadata;
  setNamedValue(form, 'title', metadata.title);
  setNamedValue(form, 'slug', metadata.slug);
  setNamedValue(form, 'excerpt', metadata.excerpt);
  setNamedValue(form, 'status', metadata.status);
  setNamedValue(form, 'updatedAt', metadata.updatedAt);
  setNamedValue(form, 'publishedAt', metadata.publishedAt ?? '');
  setNamedValue(form, 'category', metadata.category);
  setNamedValue(form, 'tags', metadata.tags.join(', '));
  setNamedValue(form, 'author', metadata.author);
  setNamedValue(form, 'coverSrc', metadata.cover.src);
  setNamedValue(form, 'coverAlt', metadata.cover.alt);
  setNamedValue(form, 'audioSrc', metadata.audio?.src ?? '');
  setNamedValue(
    form,
    'audioDurationSeconds',
    metadata.audio?.durationSeconds === undefined ? '' : String(metadata.audio.durationSeconds),
  );
  setNamedValue(form, 'body', candidate.body);

  const titleInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="referenceTitle"]'),
  );
  const urlInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="referenceUrl"]'),
  );
  const publisherInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="referencePublisher"]'),
  );
  const accessedInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="referenceAccessedAt"]'),
  );
  const count = Math.min(titleInputs.length, metadata.references.length, 100);
  for (let index = 0; index < count; index += 1) {
    const reference = metadata.references[index];
    if (reference === undefined) continue;
    const title = titleInputs[index];
    const url = urlInputs[index];
    const publisher = publisherInputs[index];
    const accessed = accessedInputs[index];
    if (title !== undefined) setInputValue(title, reference.title);
    if (url !== undefined) setInputValue(url, reference.url);
    if (publisher !== undefined) setInputValue(publisher, reference.publisher ?? '');
    if (accessed !== undefined) setInputValue(accessed, reference.accessedAt ?? '');
  }
  for (let index = count; index < titleInputs.length; index += 1) {
    const title = titleInputs[index];
    const url = urlInputs[index];
    const publisher = publisherInputs[index];
    const accessed = accessedInputs[index];
    if (title !== undefined) setInputValue(title, '');
    if (url !== undefined) setInputValue(url, '');
    if (publisher !== undefined) setInputValue(publisher, '');
    if (accessed !== undefined) setInputValue(accessed, '');
  }
}

/** Advances only server-authored hidden concurrency fields after Save/Check. */
export function applyStudioConcurrencyToForm(
  form: HTMLFormElement,
  concurrency: StudioConcurrencyEvidence,
): void {
  const setHidden = (name: string, value: string | undefined): void => {
    const existing = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
    if (value === undefined) {
      existing?.remove();
      return;
    }
    const input = existing ?? document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    if (existing === null) form.append(input);
  };

  setHidden('baseMainSha', concurrency.baseMainSha);
  setHidden('draftHeadSha', concurrency.draftHeadSha);
  setHidden('expectedBlobSha', concurrency.expectedBlobSha);
}

export { createStudioSnapshotId };
