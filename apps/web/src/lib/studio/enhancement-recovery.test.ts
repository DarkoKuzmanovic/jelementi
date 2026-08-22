import { describe, expect, it } from 'vitest';
import type { StudioEditorInput } from './contracts';
import {
  captureStudioSubmittedSnapshot,
  createFallbackStorage,
  createStudioRecoveryStore,
  decodeStudioRecoveryRecord,
  reconcileStudioRecovery,
  studioPersistentStorage,
  studioRecoveryKey,
  type StudioRecoveryRecord,
  type StudioStorageLike,
} from './enhancement-recovery';
import {
  beginStudioSubmit,
  createStudioSnapshotId,
  initialStudioTransportState,
  resolveStudioSubmit,
  shouldEnhanceSubmit,
  STUDIO_CHECK_ENHANCED_ACTIONS,
  STUDIO_EDITOR_ENHANCED_ACTIONS,
} from './enhancement-transport';

const candidate: StudioEditorInput = {
  metadata: {
    title: 'A recovered article',
    slug: 'recovered-article',
    excerpt: 'A bounded browser-held candidate.',
    status: 'draft',
    updatedAt: '2026-08-18',
    category: 'Ideas',
    tags: ['studio'],
    author: 'Jelementi',
    cover: { src: 'articles/recovered-article/cover.svg', alt: 'A lighthouse.' },
    references: [],
  },
  body: 'Newer unsaved body.',
  concurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) },
};

const record: StudioRecoveryRecord = {
  version: 1,
  candidate,
  loadedConcurrency: candidate.concurrency,
  capturedAt: '2026-08-18T12:00:00.000Z',
};

describe('decodeStudioRecoveryRecord', () => {
  it('accepts only the versioned candidate, loaded concurrency, and capture time', () => {
    expect(decodeStudioRecoveryRecord(record)).toEqual({ ok: true, value: record });
    expect(decodeStudioRecoveryRecord({ ...record, lifecycle: 'live' })).toEqual({
      ok: false,
      issues: ['recovery.unknownKey'],
    });
  });

  it('rejects an unknown schema version', () => {
    expect(decodeStudioRecoveryRecord({ ...record, version: 2 })).toEqual({
      ok: false,
      issues: ['recovery.version.version'],
    });
  });

  it('rejects a malformed or unbounded candidate through the canonical decoder', () => {
    const malformed = decodeStudioRecoveryRecord({
      ...record,
      candidate: { metadata: { not: 'a metadata shape' }, body: 'x', concurrency: {} },
    });
    expect(malformed.ok).toBe(false);
    const oversized = decodeStudioRecoveryRecord({
      ...record,
      candidate: { ...candidate, body: 'x'.repeat(2_000_001) },
    });
    expect(oversized.ok).toBe(false);
  });

  it('rejects non-object input and malformed concurrency/timestamp', () => {
    expect(decodeStudioRecoveryRecord(null).ok).toBe(false);
    expect(
      decodeStudioRecoveryRecord({ ...record, loadedConcurrency: { baseMainSha: 'nope' } }).ok,
    ).toBe(false);
    expect(decodeStudioRecoveryRecord({ ...record, capturedAt: 'yesterday' }).ok).toBe(false);
  });
});

describe('createStudioRecoveryStore', () => {
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

  it('round-trips a bounded record and treats malformed stored JSON as absent', () => {
    const store = createStudioRecoveryStore(memoryStorage());
    expect(store.available).toBe(true);
    const key = studioRecoveryKey('recovered-article');
    expect(store.write(key, record)).toBe(true);
    expect(store.read(key)).toEqual(record);
    store.clear(key);
    expect(store.read(key)).toBeUndefined();
  });

  it('is non-fatal when storage throws: disables only recovery convenience', () => {
    const throwing: StudioStorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = createStudioRecoveryStore(throwing);
    expect(store.available).toBe(false);
    expect(store.read(studioRecoveryKey('recovered-article'))).toBeUndefined();
    expect(store.write(studioRecoveryKey('recovered-article'), record)).toBe(false);
    expect(() => store.clear(studioRecoveryKey('recovered-article'))).not.toThrow();
  });

  it('is non-fatal when no storage exists at all', () => {
    const store = createStudioRecoveryStore(undefined);
    expect(store.available).toBe(false);
    expect(store.write(studioRecoveryKey('x'), record)).toBe(false);
  });

  it('namespaces the new workspace separately from article slugs', () => {
    expect(studioRecoveryKey('new')).toBe('jelementi.studio.recovery.new');
    expect(studioRecoveryKey('recovered-article')).toBe(
      'jelementi.studio.recovery.recovered-article',
    );
  });

  it('offers the same record after a full browser restart (#112)', () => {
    // "Previous session": a record written through one store instance into
    // persistent storage. A full restart means brand-new store instances
    // over the same surviving storage.
    const backing = memoryStorage();
    const previousSession = createStudioRecoveryStore(backing);
    expect(previousSession.write(studioRecoveryKey('recovered-article'), record)).toBe(true);

    const restartedSession = createStudioRecoveryStore(backing);
    expect(restartedSession.available).toBe(true);
    expect(restartedSession.read(studioRecoveryKey('recovered-article'))).toEqual(record);
  });
});

describe('createFallbackStorage (#112 graceful degradation)', () => {
  function memoryStorage(): StudioStorageLike & { values: Map<string, string> } {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
  }

  it('reads and writes through the primary while it works', () => {
    const primary = memoryStorage();
    const secondary = memoryStorage();
    const storage = createFallbackStorage(primary, secondary);

    storage.setItem('k', 'v');
    expect(primary.values.get('k')).toBe('v');
    expect(secondary.values.has('k')).toBe(false);
    expect(storage.getItem('k')).toBe('v');

    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('falls back to the secondary when the primary quota is exceeded', () => {
    const primary = memoryStorage();
    const primarySetItem = primary.setItem;
    let quotaBroken = false;
    primary.setItem = (key, value) => {
      if (quotaBroken) throw new DOMException('quota exceeded', 'QuotaExceededError');
      primarySetItem(key, value);
    };
    const secondary = memoryStorage();
    const storage = createFallbackStorage(primary, secondary);

    // A record from an earlier working phase sits in the primary…
    storage.setItem('k', 'old');
    quotaBroken = true;
    storage.setItem('k', 'fresh');

    // …but once the write lands in the fallback, reads must yield the
    // FRESHER record, never the stale primary copy.
    expect(secondary.values.get('k')).toBe('fresh');
    expect(primary.values.has('k')).toBe(false);
    expect(storage.getItem('k')).toBe('fresh');
  });

  it('keeps the previous primary record when both writes fail', () => {
    const primary = memoryStorage();
    const primarySetItem = primary.setItem;
    let everythingBroken = false;
    primary.setItem = (key, value) => {
      if (everythingBroken) throw new DOMException('quota exceeded', 'QuotaExceededError');
      primarySetItem(key, value);
    };
    const secondary = memoryStorage();
    secondary.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };
    const storage = createFallbackStorage(primary, secondary);

    storage.setItem('k', 'last-good');
    everythingBroken = true;
    // Both tiers reject the newer write: the composite surfaces the failure
    // (so the store can report unavailability) without destroying the last
    // good copy.
    expect(() => storage.setItem('k', 'never-stored')).toThrow();
    expect(storage.getItem('k')).toBe('last-good');
  });

  it('reads through to the secondary when the primary throws or misses', () => {
    const primary = memoryStorage();
    primary.getItem = () => {
      throw new Error('denied');
    };
    const secondary = memoryStorage();
    secondary.setItem('k', 'from-secondary');
    const storage = createFallbackStorage(primary, secondary);

    expect(storage.getItem('k')).toBe('from-secondary');
    expect(storage.getItem('missing')).toBeNull();

    // removeItem clears both tiers and never throws even when both do.
    primary.removeItem = () => {
      throw new Error('denied');
    };
    secondary.removeItem = () => {
      throw new Error('denied');
    };
    expect(() => storage.removeItem('k')).not.toThrow();
  });
});

describe('studioPersistentStorage (#112)', () => {
  it('exposes nothing where window storage does not exist', () => {
    // In Node there is no window/localStorage: the helper must return
    // undefined so callers degrade to the unavailable store instead of
    // throwing. If jsdom ever injects globals this assertion needs a stub
    // environment; today it documents the SSR/no-window contract.
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;
    const originalSessionStorage = globalThis.sessionStorage;
    // @ts-expect-error test-only deletion of environment globals
    delete globalThis.window;
    // @ts-expect-error test-only deletion of environment globals
    delete globalThis.localStorage;
    // @ts-expect-error test-only deletion of environment globals
    delete globalThis.sessionStorage;
    try {
      expect(studioPersistentStorage()).toBeUndefined();
    } finally {
      if (originalWindow !== undefined) globalThis.window = originalWindow;
      if (originalLocalStorage !== undefined) globalThis.localStorage = originalLocalStorage;
      if (originalSessionStorage !== undefined) globalThis.sessionStorage = originalSessionStorage;
    }
  });
});

describe('reconcileStudioRecovery', () => {
  it('offers matching recovery only when fresh concurrency equals the loaded evidence', () => {
    expect(reconcileStudioRecovery(record, candidate.concurrency)).toBe('matching');
    expect(
      reconcileStudioRecovery(record, { ...candidate.concurrency, draftHeadSha: 'c'.repeat(40) }),
    ).toBe('stale');
  });
});

describe('captureStudioSubmittedSnapshot', () => {
  it('captures a bounded immutable snapshot from the editor form fields', () => {
    const form = new FormData();
    form.set('title', candidate.metadata.title);
    form.set('slug', candidate.metadata.slug);
    form.set('excerpt', candidate.metadata.excerpt);
    form.set('status', 'draft');
    form.set('updatedAt', '2026-08-18');
    form.set('category', 'Ideas');
    form.set('tags', 'studio, recovery');
    form.set('author', 'Jelementi');
    form.set('coverSrc', 'articles/recovered-article/cover.svg');
    form.set('coverAlt', 'A lighthouse.');
    form.set('body', 'Newer unsaved body.');
    form.set('baseMainSha', 'a'.repeat(40));
    form.set('draftHeadSha', 'b'.repeat(40));

    const snapshot = captureStudioSubmittedSnapshot(form);
    expect(snapshot).toBeDefined();
    expect(snapshot?.metadata.tags).toEqual(['studio', 'recovery']);
    expect(snapshot?.body).toBe('Newer unsaved body.');
  });

  it('returns undefined for a malformed form so the caller falls through to native submission', () => {
    const form = new FormData();
    form.set('title', 'x');
    form.set('slug', 'x');
    form.set('status', 'bogus');
    expect(captureStudioSubmittedSnapshot(form)).toBeUndefined();
  });
});

describe('selective enhancement transport', () => {
  it('enhances only exact Preview and Save submitters on the editor form', () => {
    expect(shouldEnhanceSubmit('?/preview', STUDIO_EDITOR_ENHANCED_ACTIONS)).toBe(true);
    expect(shouldEnhanceSubmit('?/save', STUDIO_EDITOR_ENHANCED_ACTIONS)).toBe(true);
    expect(shouldEnhanceSubmit('?/publish', STUDIO_EDITOR_ENHANCED_ACTIONS)).toBe(false);
    expect(shouldEnhanceSubmit('?/replace', STUDIO_EDITOR_ENHANCED_ACTIONS)).toBe(false);
    expect(shouldEnhanceSubmit(undefined, STUDIO_EDITOR_ENHANCED_ACTIONS)).toBe(false);
  });

  it('enhances only exact Check status submitters on the check forms', () => {
    expect(shouldEnhanceSubmit('?/refresh', STUDIO_CHECK_ENHANCED_ACTIONS)).toBe(true);
    expect(shouldEnhanceSubmit('?/check', STUDIO_CHECK_ENHANCED_ACTIONS)).toBe(true);
    expect(shouldEnhanceSubmit('?/publish', STUDIO_CHECK_ENHANCED_ACTIONS)).toBe(false);
  });

  it('locks pending and resolves before-send without counting a failure', () => {
    const pending = beginStudioSubmit(initialStudioTransportState());
    expect(pending.pending).toBe(true);
    const beforeSend = resolveStudioSubmit(pending, 'before-send');
    expect(beforeSend).toEqual({ pending: false, consecutiveFailures: 0, disabled: false });
  });

  it('never retries automatically: uncertain completion preserves state and counts a failure', () => {
    const pending = beginStudioSubmit(initialStudioTransportState());
    const uncertain = resolveStudioSubmit(pending, 'uncertain');
    expect(uncertain).toEqual({ pending: false, consecutiveFailures: 1, disabled: false });
    // The caller offers explicit Check status / full-page action; the
    // coordinator has no retry path.
  });

  it('disables enhancement for the form after two transport failures, sticky for the session', () => {
    const first = resolveStudioSubmit(
      beginStudioSubmit(initialStudioTransportState()),
      'uncertain',
    );
    const second = resolveStudioSubmit(beginStudioSubmit(first), 'uncertain');
    expect(second).toEqual({ pending: false, consecutiveFailures: 2, disabled: true });
    // A later success never re-enables a disabled form until reload.
    const success = resolveStudioSubmit(beginStudioSubmit(second), 'success');
    expect(success).toEqual({ pending: false, consecutiveFailures: 0, disabled: true });
  });

  it('produces bounded snapshot ids matching the envelope id grammar', () => {
    const id = createStudioSnapshotId();
    expect(/^[A-Za-z0-9._-]{1,200}$/.test(id)).toBe(true);
  });
});
