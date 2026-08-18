import { describe, expect, it } from 'vitest';
import type { StudioEditorInput } from './contracts';
import {
  captureStudioSubmittedSnapshot,
  createStudioRecoveryStore,
  decodeStudioRecoveryRecord,
  reconcileStudioRecovery,
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
