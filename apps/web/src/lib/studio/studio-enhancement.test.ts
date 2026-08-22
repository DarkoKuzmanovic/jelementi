import { describe, expect, it } from 'vitest';
import type { StudioEditorInput, StudioLifecycle } from './contracts';
import { buildStudioWorkspaceProjection } from './workspace-projection';
import {
  buildStudioFlowboardCheckEnvelope,
  decodeStudioFlowboardCheckEnvelope,
  decodeStudioFlowboardProjection,
} from './flowboard-envelope';
import {
  createStudioEnhancementController,
  createStudioRecoveryTracker,
  studioSnapshotMatchesLive,
  type StudioActionResponseLike,
  type StudioEnhancementFormLike,
  type StudioSubmitEventLike,
  type StudioSubmitterLike,
} from './studio-enhancement-controller';
import { createStudioSubmittedSnapshotId } from './enhancement-transport';
import { createStudioRecoveryStore, type StudioStorageLike } from './enhancement-recovery';

const concurrency = { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) };
const lifecycle: StudioLifecycle = {
  kind: 'draft_valid',
  article: {
    slug: 'lighthouse-watch',
    title: 'The Lighthouse Watch',
    status: 'draft',
    updatedAt: '2026-08-18',
  },
  branch: {
    name: 'studio/article/lighthouse-watch',
    url: 'https://github.com/example/example/tree/studio/article/lighthouse-watch',
    headSha: 'b'.repeat(40),
  },
};
const projection = buildStudioWorkspaceProjection(lifecycle, concurrency);
const card = {
  slug: 'lighthouse-watch',
  title: 'The Lighthouse Watch',
  updatedAt: '2026-08-18',
  column: 'resume-work' as const,
  projection,
  primaryAction: { kind: 'check' as const, label: 'Check status' as const },
  searchText: 'lighthouse watch ready to publish',
};
const flowboard = {
  totalCount: 1,
  columns: { resumeWork: [card], readyForDecision: [], library: [] },
};

describe('decodeStudioFlowboardCheckEnvelope', () => {
  it('round-trips the complete server-assigned Flowboard projection', () => {
    const envelope = buildStudioFlowboardCheckEnvelope(
      { operationId: 'op-1', submittedSnapshotId: 'snap-1' },
      'lighthouse-watch',
      flowboard,
      { outcome: 'checked' },
    );
    expect(decodeStudioFlowboardCheckEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it('rejects a projection whose totalCount does not match the card sum', () => {
    const result = decodeStudioFlowboardProjection({
      totalCount: 2,
      columns: flowboard.columns,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('flowboard.totalCount.mismatch');
  });

  it('rejects a card assigned to the wrong column and an unknown envelope key', () => {
    const wrongColumn = decodeStudioFlowboardCheckEnvelope(
      buildStudioFlowboardCheckEnvelope(
        { operationId: 'op-1', submittedSnapshotId: 'snap-1' },
        'lighthouse-watch',
        {
          totalCount: 1,
          columns: {
            resumeWork: [],
            readyForDecision: [{ ...card, column: 'resume-work' }],
            library: [],
          },
        },
        { outcome: 'checked' },
      ),
    );
    expect(wrongColumn.ok).toBe(false);

    const unknownKey = decodeStudioFlowboardCheckEnvelope({
      kind: 'flowboard_check',
      operationId: 'op-1',
      submittedSnapshotId: 'snap-1',
      checkedSlug: 'lighthouse-watch',
      flowboard,
      lifecycle: 'live',
    });
    expect(unknownKey.ok).toBe(false);
  });

  it('rejects a malformed nested card projection and an invalid id', () => {
    const badProjection = decodeStudioFlowboardCheckEnvelope(
      buildStudioFlowboardCheckEnvelope(
        { operationId: 'op-1', submittedSnapshotId: 'snap-1' },
        'lighthouse-watch',
        {
          totalCount: 1,
          columns: {
            resumeWork: [{ ...card, projection: { bogus: true } as never }],
            readyForDecision: [],
            library: [],
          },
        },
        { outcome: 'checked' },
      ),
    );
    expect(badProjection.ok).toBe(false);

    const badId = decodeStudioFlowboardCheckEnvelope({
      kind: 'flowboard_check',
      operationId: 'has spaces',
      submittedSnapshotId: 'snap-1',
      checkedSlug: 'lighthouse-watch',
      flowboard,
    });
    expect(badId.ok).toBe(false);
  });
});

// --- controller fixtures ---------------------------------------------------

const candidate: StudioEditorInput = {
  metadata: {
    title: 'The Lighthouse Watch',
    slug: 'lighthouse-watch',
    excerpt: 'A bounded candidate.',
    status: 'draft',
    updatedAt: '2026-08-18',
    category: 'Ideas',
    tags: ['studio'],
    author: 'Jelementi',
    cover: { src: 'articles/lighthouse-watch/cover.svg', alt: 'A lighthouse.' },
    references: [],
  },
  body: 'A new paragraph.',
  concurrency,
};

function submitter(action: string | null): StudioSubmitterLike {
  return { formAction: action, disabled: false };
}

function fakeEvent(sub: StudioSubmitterLike | null): StudioSubmitEventLike {
  const event: StudioSubmitEventLike = {
    defaultPrevented: false,
    submitter: sub,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

function fakeForm(): StudioEnhancementFormLike & {
  listeners: Array<(event: StudioSubmitEventLike) => void>;
  nativeSubmissions: Array<StudioSubmitterLike | null>;
} {
  const listeners: Array<(event: StudioSubmitEventLike) => void> = [];
  const nativeSubmissions: Array<StudioSubmitterLike | null> = [];
  return {
    action: '/studio/articles/lighthouse-watch?/preview',
    method: 'POST',
    listeners,
    nativeSubmissions,
    addEventListener(type, listener) {
      if (type === 'submit') listeners.push(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'submit') {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }
    },
    requestSubmit(sub) {
      nativeSubmissions.push(sub ?? null);
      // Native submission would dispatch a fresh submit event; the
      // controller's in-progress guard must make that a no-op.
      for (const listener of [...listeners]) listener(fakeEvent(sub ?? null));
    },
  };
}

function controllerWith(
  form: StudioEnhancementFormLike,
  overrides: Partial<{
    capture: () => StudioEditorInput | undefined;
    live: () => StudioEditorInput;
    response: () => StudioActionResponseLike;
    throwOnFetch: boolean;
  }> = {},
): {
  controller: ReturnType<typeof createStudioEnhancementController>;
  applied: unknown[];
  polite: string[];
  assertive: string[];
  pendingChanges: boolean[];
  states: ReturnType<typeof import('./enhancement-transport').initialStudioTransportState>[];
  redirects: string[];
  unknown: number;
} {
  const capture = overrides.capture ?? (() => candidate);
  const live = overrides.live ?? (() => candidate);
  const response = overrides.response ?? (() => ({ type: 'success' as const, data: {} }));
  const applied: unknown[] = [];
  const polite: string[] = [];
  const assertive: string[] = [];
  const pendingChanges: boolean[] = [];
  const states: Array<{ pending: boolean; consecutiveFailures: number; disabled: boolean }> = [];
  const redirects: string[] = [];
  let unknown = 0;

  const controller = createStudioEnhancementController({
    form,
    enhancedActions: ['?/preview', '?/save'],
    captureSnapshot: capture,
    buildBody: (snapshot, ids) => {
      const body = new FormData();
      body.set('title', snapshot.metadata.title);
      body.set('enhancementOperationId', ids.operationId);
      body.set('submittedSnapshotId', ids.submittedSnapshotId);
      return body;
    },
    deserialize: (text) => JSON.parse(text) as StudioActionResponseLike,
    fetchImpl: () =>
      overrides.throwOnFetch === true
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({ text: async () => JSON.stringify(response()) } as Response),
    envelopeCorrelation: (data) =>
      data && typeof data === 'object' && 'submittedSnapshotId' in (data as object)
        ? { submittedSnapshotId: (data as { submittedSnapshotId: string }).submittedSnapshotId }
        : undefined,
    applyEnvelope: (data) => {
      applied.push(data);
    },
    liveSnapshotId: () => createStudioSubmittedSnapshotId(live()),
    announcePolite: (message) => {
      polite.push(message);
    },
    announceAssertive: (message) => {
      assertive.push(message);
    },
    onPendingChanged: (pending) => {
      pendingChanges.push(pending);
    },
    onCompletionUnknown: () => {
      unknown += 1;
    },
    onRedirect: (location) => {
      redirects.push(location);
    },
    onStateChanged: (state) => {
      states.push({ ...state });
    },
  });
  return {
    controller,
    applied,
    polite,
    assertive,
    pendingChanges,
    states,
    redirects,
    get unknown() {
      return unknown;
    },
  };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createStudioEnhancementController', () => {
  it('intercepts only exact allowlisted submitters; others fall through natively', () => {
    const form = fakeForm();
    const { controller } = controllerWith(form);
    controller.install();

    for (const action of ['?/publish', '?/replace', '?/unpublish', '?/discard']) {
      const event = fakeEvent(submitter(action));
      form.listeners[0]?.(event);
      expect(event.defaultPrevented).toBe(false);
    }
    const unknownSubmitter = fakeEvent(null);
    form.listeners[0]?.(unknownSubmitter);
    expect(unknownSubmitter.defaultPrevented).toBe(false);
    expect(form.nativeSubmissions).toEqual([]);

    const preview = fakeEvent(submitter('?/preview'));
    form.listeners[0]?.(preview);
    expect(preview.defaultPrevented).toBe(true);
    expect(form.nativeSubmissions).toEqual([]);
  });

  it('falls through once to native submission when the snapshot cannot be captured', () => {
    const form = fakeForm();
    const { controller } = controllerWith(form, { capture: () => undefined });
    controller.install();

    const event = fakeEvent(submitter('?/save'));
    form.listeners[0]?.(event);
    expect(event.defaultPrevented).toBe(false);
    // The controller did not call requestSubmit; the browser owns the one
    // original native submission.
    expect(form.nativeSubmissions).toHaveLength(0);
    expect(controller.state.pending).toBe(false);
    expect(controller.state.consecutiveFailures).toBe(0);
  });

  it('applies the authoritative envelope only when the live snapshot still matches', async () => {
    const form = fakeForm();
    const submittedId = createStudioSubmittedSnapshotId(candidate);
    const { controller, applied, polite } = controllerWith(form, {
      response: () => ({ type: 'success', data: { submittedSnapshotId: submittedId } }),
    });
    controller.install();

    form.listeners[0]?.(fakeEvent(submitter('?/preview')));
    await tick();
    expect(applied).toHaveLength(1);
    expect(polite).toContain('Updated.');

    // A response echoing a stale id (or newer typing) is never applied.
    const stale = controllerWith(form, {
      response: () => ({ type: 'success', data: { submittedSnapshotId: 'snapshot-old' } }),
      live: () => ({ ...candidate, body: 'NEWER typing.' }),
    });
    stale.controller.install();
    form.listeners[0]?.(fakeEvent(submitter('?/preview')));
    await tick();
    expect(stale.applied).toHaveLength(0);
  });

  it('announces Completion unknown on transport failure and never retries automatically', async () => {
    const form = fakeForm();
    const result = controllerWith(form, { throwOnFetch: true });
    result.controller.install();

    form.listeners[0]?.(fakeEvent(submitter('?/preview')));
    await tick();
    expect(result.unknown).toBe(1);
    const { controller, assertive } = result;
    expect(assertive).toHaveLength(0);
    expect(controller.state.consecutiveFailures).toBe(1);
    expect(controller.state.pending).toBe(false);
  });

  it('disables enhancement for the form after two uncertain outcomes, sticky until reload', async () => {
    const form = fakeForm();
    const { controller } = controllerWith(form, { throwOnFetch: true });
    controller.install();

    form.listeners[0]?.(fakeEvent(submitter('?/preview')));
    await tick();
    form.listeners[0]?.(fakeEvent(submitter('?/preview')));
    await tick();
    expect(controller.state.consecutiveFailures).toBe(2);
    expect(controller.state.disabled).toBe(true);

    // Disabled: the listener leaves the original event unprevented, so the
    // browser performs the native submission without requestSubmit.
    const event = fakeEvent(submitter('?/preview'));
    form.listeners[0]?.(event);
    expect(event.defaultPrevented).toBe(false);
    expect(form.nativeSubmissions).toHaveLength(0);
  });

  it('follows a server redirect (full navigation) and never counts it as failure', async () => {
    const form = fakeForm();
    const { controller, redirects } = controllerWith(form, {
      response: () => ({ type: 'redirect', location: '/studio/articles/lighthouse-watch' }),
    });
    controller.install();

    form.listeners[0]?.(fakeEvent(submitter('?/save')));
    await tick();
    expect(redirects).toEqual(['/studio/articles/lighthouse-watch']);
    expect(controller.state.consecutiveFailures).toBe(0);
  });

  it('treats a server error response as authoritative (no retry, no transport counter)', async () => {
    const form = fakeForm();
    const { controller, assertive } = controllerWith(form, {
      response: () => ({ type: 'error', error: { message: 'invalid form' } }),
    });
    controller.install();

    form.listeners[0]?.(fakeEvent(submitter('?/save')));
    await tick();
    expect(assertive).toHaveLength(1);
    expect(controller.state.consecutiveFailures).toBe(0);
  });

  it('destroy() stops intercepting', () => {
    const form = fakeForm();
    const { controller } = controllerWith(form);
    controller.install();
    controller.destroy();
    expect(form.listeners).toHaveLength(0);
  });
});

describe('studioSnapshotMatchesLive', () => {
  it('matches identical content and rejects newer typing', () => {
    const id = createStudioSubmittedSnapshotId(candidate);
    expect(studioSnapshotMatchesLive(id, candidate)).toBe(true);
    expect(studioSnapshotMatchesLive(id, { ...candidate, body: 'newer' })).toBe(false);
  });
});

describe('createStudioRecoveryTracker', () => {
  function memoryStorage(): StudioStorageLike {
    const values = new Map<string, string>();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
  }

  it('writes one debounced bounded record and flushes on demand', () => {
    const store = createStudioRecoveryStore(memoryStorage());
    let fired: (() => void) | undefined;
    const tracker = createStudioRecoveryTracker({
      store,
      key: 'jelementi.studio.recovery.lighthouse-watch',
      debounceMs: 300,
      now: () => '2026-08-18T12:00:00.000Z',
      setTimeoutFn: ((fn: () => void) => {
        fired = fn;
        return 1;
      }) as typeof setTimeout,
      clearTimeoutFn: (() => {
        fired = undefined;
      }) as typeof clearTimeout,
    });

    tracker.track(candidate);
    expect(store.read('jelementi.studio.recovery.lighthouse-watch')).toBeUndefined();
    fired?.();
    const record = store.read('jelementi.studio.recovery.lighthouse-watch');
    expect(record?.candidate.body).toBe('A new paragraph.');
    expect(record?.capturedAt).toBe('2026-08-18T12:00:00.000Z');

    tracker.track({ ...candidate, body: 'after flush' });
    tracker.flush();
    expect(store.read('jelementi.studio.recovery.lighthouse-watch')?.candidate.body).toBe(
      'after flush',
    );
    tracker.clear();
    expect(store.read('jelementi.studio.recovery.lighthouse-watch')).toBeUndefined();
    tracker.stop();
  });

  it('makes a later quota failure visible and disables further recovery writes', () => {
    let reports = 0;
    let writes = 0;
    const tracker = createStudioRecoveryTracker({
      store: {
        available: true,
        read: () => undefined,
        write: () => {
          writes += 1;
          return false;
        },
        clear: () => undefined,
      },
      key: 'jelementi.studio.recovery.lighthouse-watch',
      debounceMs: 0,
      onUnavailable: () => {
        reports += 1;
      },
    });

    tracker.track(candidate);
    tracker.flush();
    tracker.track({ ...candidate, body: 'newer' });
    tracker.flush();

    expect(reports).toBe(1);
    expect(writes).toBe(1);
    expect(tracker.available).toBe(false);
  });

  it('is non-fatal and reports once when storage is unavailable', () => {
    let reports = 0;
    const tracker = createStudioRecoveryTracker({
      store: createStudioRecoveryStore(undefined),
      key: 'jelementi.studio.recovery.lighthouse-watch',
      onUnavailable: () => {
        reports += 1;
      },
    });
    tracker.track(candidate);
    tracker.flush();
    expect(reports).toBe(1);
    expect(tracker.available).toBe(false);
  });
});
