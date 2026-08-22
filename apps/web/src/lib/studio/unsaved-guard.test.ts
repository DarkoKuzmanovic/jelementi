import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStudioUnsavedGuard, type UnsavedGuardHost } from './unsaved-guard';

/**
 * #112 survivable unsaved writing: the native leave-confirmation guard.
 *
 * The guard must prompt exactly when the editor is dirty, never on a clean
 * editor, and never for same-page form submissions (SvelteKit full-page
 * posts carry their own explicit intent — Save persists server-side, and
 * Preview/Save candidates are already flushed to the recovery record on
 * `pagehide`). Enhanced fetch submissions never unload the document, so a
 * submit-time suppression must expire instead of lingering.
 */

interface Harness {
  host: UnsavedGuardHost;
  beforeUnloadListeners: Array<(event: FakeBeforeUnloadEvent) => void>;
  submitListeners: Array<(event: FakeSubmitEvent) => void>;
  inputListeners: Array<(event: Event) => void>;
  unload(): FakeBeforeUnloadEvent;
  submit(): void;
  type(): void;
}

class FakeBeforeUnloadEvent {
  defaultPrevented = false;
  returnValue = '';
  preventDefault(): void {
    this.defaultPrevented = true;
    this.returnValue = '';
  }
}

interface FakeSubmitEvent {
  defaultPrevented: boolean;
}

afterEach(() => {
  vi.useRealTimers();
});

function harness(): Harness {
  const beforeUnloadListeners: Array<(event: FakeBeforeUnloadEvent) => void> = [];
  const submitListeners: Array<(event: FakeSubmitEvent) => void> = [];
  const inputListeners: Array<(event: Event) => void> = [];
  const host: UnsavedGuardHost = {
    addEventListener: (type, listener) => {
      if (type === 'beforeunload') {
        beforeUnloadListeners.push(listener as (event: FakeBeforeUnloadEvent) => void);
      }
    },
    removeEventListener: (type, listener) => {
      if (type !== 'beforeunload') return;
      const index = beforeUnloadListeners.indexOf(
        listener as (event: FakeBeforeUnloadEvent) => void,
      );
      if (index >= 0) beforeUnloadListeners.splice(index, 1);
    },
    document: {
      addEventListener: (type, listener) => {
        if (type === 'submit') {
          submitListeners.push(listener as (event: FakeSubmitEvent) => void);
        }
        if (type === 'input') {
          inputListeners.push(listener as (event: Event) => void);
        }
      },
      removeEventListener: (type, listener) => {
        if (type === 'submit') {
          const index = submitListeners.indexOf(listener as (event: FakeSubmitEvent) => void);
          if (index >= 0) submitListeners.splice(index, 1);
        }
        if (type === 'input') {
          const index = inputListeners.indexOf(listener as (event: Event) => void);
          if (index >= 0) inputListeners.splice(index, 1);
        }
      },
    },
    setTimeoutFn: ((callback: () => void) => setTimeout(callback, 0)) as typeof setTimeout,
    clearTimeoutFn: ((handle: Parameters<typeof clearTimeout>[0]) =>
      clearTimeout(handle)) as typeof clearTimeout,
  };
  return {
    host,
    beforeUnloadListeners,
    submitListeners,
    inputListeners,
    unload(): FakeBeforeUnloadEvent {
      const event = new FakeBeforeUnloadEvent();
      for (const listener of [...beforeUnloadListeners]) listener(event);
      return event;
    },
    submit(): void {
      for (const listener of [...submitListeners]) listener({ defaultPrevented: false });
    },
    type(): void {
      for (const listener of [...inputListeners]) listener(new Event('input'));
    },
  };
}

describe('createStudioUnsavedGuard', () => {
  it('registers the beforeunload listener only while dirty and removes it when clean', () => {
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);
    expect(h.beforeUnloadListeners).toHaveLength(0);

    guard.setDirty(true);
    expect(h.beforeUnloadListeners).toHaveLength(1);

    guard.setDirty(false);
    expect(h.beforeUnloadListeners).toHaveLength(0);

    // Re-dirtying after a clean spell re-registers exactly one listener
    // (never a double-prompt from stacked handlers).
    guard.setDirty(true);
    expect(h.beforeUnloadListeners).toHaveLength(1);
    guard.destroy();
    expect(h.beforeUnloadListeners).toHaveLength(0);
  });

  it('prompts only while dirty', () => {
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);

    guard.setDirty(false);
    expect(h.unload().defaultPrevented).toBe(false);

    guard.setDirty(true);
    const event = h.unload();
    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe('unsaved');
    guard.destroy();
  });

  it('suppresses exactly one unload after a same-page form submission while dirty', () => {
    vi.useFakeTimers();
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);
    guard.setDirty(true);

    // A full-page SvelteKit post (Save/Preview/Discard…) is an explicit
    // same-page action: its unload must not prompt.
    h.submit();
    expect(h.unload().defaultPrevented).toBe(false);

    // The suppression is one-shot: a later genuine close still prompts…
    expect(h.unload().defaultPrevented).toBe(true);
    guard.destroy();
  });

  it('expires submit suppression when no navigation follows (enhanced fetch submits)', async () => {
    vi.useFakeTimers();
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);
    guard.setDirty(true);

    // An enhanced submission prevents default and uses fetch — the document
    // never unloads. The scheduled expiry must clear the pending
    // suppression so the next real close still prompts.
    h.submit();
    await vi.runAllTimersAsync();
    expect(h.unload().defaultPrevented).toBe(true);
    guard.destroy();
  });

  it('cancels pending submit suppression when the user resumes typing', () => {
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);
    guard.setDirty(true);

    h.submit();
    h.type();
    expect(h.unload().defaultPrevented).toBe(true);
    guard.destroy();
  });

  it('ignores submits and typing while clean and tears down every listener', () => {
    const h = harness();
    const guard = createStudioUnsavedGuard(h.host);
    guard.setDirty(false);

    h.submit();
    h.type();
    expect(h.unload().defaultPrevented).toBe(false);

    guard.setDirty(true);
    // A stale suppression from the clean period must not leak into the
    // newly dirty state.
    expect(h.unload().defaultPrevented).toBe(true);
    guard.destroy();

    expect(h.beforeUnloadListeners).toHaveLength(0);
    expect(h.submitListeners).toHaveLength(0);
    expect(h.inputListeners).toHaveLength(0);
  });
});
