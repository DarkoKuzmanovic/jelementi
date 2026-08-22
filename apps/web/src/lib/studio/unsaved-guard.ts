/**
 * Native leave-confirmation guard for unsaved editor changes (#112).
 *
 * While the article-editor page reports a dirty candidate, a `beforeunload`
 * listener is registered so closing/reloading the tab or navigating away
 * externally triggers the browser's own confirmation dialog. A clean editor
 * carries no unload listener at all and can never prompt.
 *
 * Same-page form submissions are deliberately exempt (#112 decision):
 * - Enhanced submissions use fetch and never unload the document, so they
 *   could not prompt anyway — but their `submit` event must not leave a
 *   lingering suppression behind. The pending suppression therefore expires
 *   on a zero-delay timer whenever no unload actually follows.
 * - SvelteKit full-page posts (no-JS fallback, disabled enhancement) DO
 *   unload the document, but they are explicit user actions whose content
 *   is already protected: Save persists server-side, and Preview/Save
 *   candidates are flushed to the recovery record on `pagehide` by the
 *   recovery panel. Prompting "leave with unsaved changes?" on a click
 *   inside the same page would be hostile without protecting anything new,
 *   so exactly the unload caused by a form submission is suppressed
 *   (one-shot), and any further user typing cancels the exemption.
 *
 * Client-safe and unit-testable without a DOM through the structural host.
 */

export interface UnsavedGuardBeforeUnloadEventLike {
  preventDefault(): void;
  returnValue: string;
}

export interface UnsavedGuardDocumentLike {
  addEventListener(type: 'submit' | 'input', listener: (event: Event) => void): void;
  removeEventListener(type: 'submit' | 'input', listener: (event: Event) => void): void;
}

export interface UnsavedGuardHost {
  addEventListener(
    type: 'beforeunload',
    listener: (event: UnsavedGuardBeforeUnloadEventLike) => void,
  ): void;
  removeEventListener(
    type: 'beforeunload',
    listener: (event: UnsavedGuardBeforeUnloadEventLike) => void,
  ): void;
  document: UnsavedGuardDocumentLike;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface StudioUnsavedGuard {
  /** Flips the native confirmation on/off with the page's dirty flag. */
  setDirty(dirty: boolean): void;
  destroy(): void;
}

export function createStudioUnsavedGuard(host: UnsavedGuardHost): StudioUnsavedGuard {
  const setTimeoutFn = host.setTimeoutFn ?? setTimeout.bind(globalThis);
  const clearTimeoutFn = host.clearTimeoutFn ?? clearTimeout.bind(globalThis);

  let dirty = false;
  let attached = false;
  let suppressNextUnload = false;
  let expiryHandle: ReturnType<typeof setTimeout> | undefined;

  const clearExpiry = (): void => {
    if (expiryHandle !== undefined) {
      clearTimeoutFn(expiryHandle);
      expiryHandle = undefined;
    }
  };

  const cancelSuppression = (): void => {
    suppressNextUnload = false;
    clearExpiry();
  };

  const onBeforeUnload = (event: UnsavedGuardBeforeUnloadEventLike): void => {
    if (!dirty) return;
    if (suppressNextUnload) {
      // One-shot exemption for the unload caused by a same-page submission.
      cancelSuppression();
      return;
    }
    // Both the modern API flag and the legacy returnValue chain the dialog.
    // The legacy string must be non-empty: some engines treat an empty
    // returnValue as "no confirmation requested".
    event.preventDefault();
    event.returnValue = 'unsaved';
  };

  const onSubmit = (): void => {
    if (!dirty) return;
    cancelSuppression();
    suppressNextUnload = true;
    // If no navigation follows (enhanced fetch submit, failed/blocked nav),
    // expire immediately so a later genuine close still prompts.
    expiryHandle = setTimeoutFn(() => {
      expiryHandle = undefined;
      suppressNextUnload = false;
    }, 0);
  };

  const onInput = (): void => {
    // Typing again after a non-navigating submit re-arms full protection.
    if (suppressNextUnload) cancelSuppression();
  };

  // Capture-phase document listeners observe every submission/keystroke on
  // the page; they only ever matter while dirty.
  host.document.addEventListener('submit', onSubmit);
  host.document.addEventListener('input', onInput);

  return {
    setDirty(next) {
      if (next === dirty) return;
      dirty = next;
      if (dirty) {
        // A freshly dirty editor starts unprotected-by-suppression: any
        // stale exemption from a previous clean period must not leak in.
        cancelSuppression();
        if (!attached) {
          host.addEventListener('beforeunload', onBeforeUnload);
          attached = true;
        }
      } else {
        cancelSuppression();
        if (attached) {
          host.removeEventListener('beforeunload', onBeforeUnload);
          attached = false;
        }
      }
    },
    destroy() {
      dirty = false;
      cancelSuppression();
      if (attached) {
        host.removeEventListener('beforeunload', onBeforeUnload);
        attached = false;
      }
      host.document.removeEventListener('submit', onSubmit);
      host.document.removeEventListener('input', onInput);
    },
  };
}

/** Installs the guard over the real browser globals (client-only callers). */
export function installStudioUnsavedGuard(): StudioUnsavedGuard {
  return createStudioUnsavedGuard({
    addEventListener: (type, listener) =>
      window.addEventListener(type, listener as (event: BeforeUnloadEvent) => void),
    removeEventListener: (type, listener) =>
      window.removeEventListener(type, listener as (event: BeforeUnloadEvent) => void),
    document: {
      addEventListener: (type, listener) =>
        document.addEventListener(type, listener, { capture: true }),
      removeEventListener: (type, listener) =>
        document.removeEventListener(type, listener, { capture: true }),
    },
  });
}
