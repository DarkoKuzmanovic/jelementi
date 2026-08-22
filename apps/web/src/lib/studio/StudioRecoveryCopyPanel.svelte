<script lang="ts">
  import { onMount } from 'svelte';
  import type { StudioConcurrencyEvidence } from './contracts';
  import type { StudioRecoveryRecord } from './enhancement-recovery';
  import {
    createStudioRecoveryStore,
    reconcileStudioRecovery,
    studioPersistentStorage,
    studioRecoveryKey,
    type StudioRecoveryStore,
  } from './enhancement-recovery';
  import {
    createStudioRecoveryTracker,
    type StudioRecoveryTracker,
  } from './studio-enhancement-controller';
  import { captureLiveEditorCandidate, restoreCandidateToForm } from './studio-enhancement-page';

  /**
   * Browser recovery-copy host and panel (#78).
   *
   * This component OWNS all recovery-copy state and wiring for ONE article
   * workspace (`identity` = slug, or `new` before the first Save). The
   * owning page passes only stable props; every keystroke-driven state
   * update happens inside this component's own reactive scope, so typing
   * can never re-render the sibling editor form (which would reset native
   * inputs to their server-bound values).
   *
   * Behavior contract (#72 "Recovery-copy contract", #112 persistence):
   * - One persistent record per workspace (localStorage first, session
   *   fallback), written after a 300ms debounce and flushed on `pagehide`;
   *   always labelled "Not saved yet".
   * - Never auto-applies. Matching evidence offers explicit "Restore
   *   recovery copy"; moved evidence shows fresh server content first and
   *   offers explicit "Compare/Restore" (two-step: compare then restore).
   * - Malformed/unknown records are treated as absent; storage
   *   unavailability is non-fatal and visibly disables only this
   *   convenience.
   * - The page may drive lifecycle clearing and first-Save migration
   *   through the `onReady` deps (tracker/store/key + `clearRecord`).
   */

  let {
    identity,
    loadedConcurrency,
    formId = 'studio-article-form',
    onRestored,
    onReady,
    onCandidateChange,
  }: {
    identity: string;
    loadedConcurrency: StudioConcurrencyEvidence;
    formId?: string;
    onRestored?: () => void;
    onReady?: (deps: {
      store: StudioRecoveryStore;
      tracker: StudioRecoveryTracker;
      key: string;
      clearRecord(): void;
    }) => void;
    onCandidateChange?: (candidate: StudioRecoveryRecord['candidate'] | undefined) => void;
  } = $props();

  let recoveryRecord = $state<StudioRecoveryRecord | undefined>(undefined);
  let reconciliation = $state<'matching' | 'stale' | undefined>(undefined);
  let unavailable = $state(false);
  let comparing = $state(false);

  let tracker: StudioRecoveryTracker | undefined;
  let store: StudioRecoveryStore | undefined;
  let key: string | undefined;

  onMount(() => {
    // #112: records persist in localStorage (session fallback) so recovery
    // survives full browser restarts; the store's guards keep every
    // storage failure non-fatal.
    const recoveryStore = createStudioRecoveryStore(studioPersistentStorage());
    const recoveryKey = studioRecoveryKey(identity);
    const stored = recoveryStore.read(recoveryKey);
    recoveryRecord = stored;
    if (stored !== undefined) {
      reconciliation = reconcileStudioRecovery(stored, loadedConcurrency);
    }
    unavailable = !recoveryStore.available;

    const recoveryTracker = createStudioRecoveryTracker({
      store: recoveryStore,
      key: recoveryKey,
      onUnavailable: () => {
        unavailable = true;
      },
      // When the debounced recovery copy lands, surface it in the panel so
      // the restore offer matches exactly what is stored, and report the
      // candidate upward (also debounced — never synchronously during the
      // input event, which would re-render sibling editor inputs).
      onWrite: (record) => {
        recoveryRecord = record;
        reconciliation = reconcileStudioRecovery(record, loadedConcurrency);
        onCandidateChange?.(record.candidate);
      },
    });
    const onPagehide = (): void => recoveryTracker.flush();
    window.addEventListener('pagehide', onPagehide);

    const formEl = document.getElementById(formId) as HTMLFormElement | null;
    if (formEl === null) return;
    const onInput = (): void => {
      recoveryTracker.track(captureLiveEditorCandidate(formEl) ?? undefined);
    };
    formEl.addEventListener('input', onInput);

    const clearRecord = (): void => {
      recoveryTracker.clear();
      recoveryRecord = undefined;
      reconciliation = undefined;
      comparing = false;
    };

    tracker = recoveryTracker;
    store = recoveryStore;
    key = recoveryKey;
    onReady?.({ store: recoveryStore, tracker: recoveryTracker, key: recoveryKey, clearRecord });

    return () => {
      formEl?.removeEventListener('input', onInput);
      window.removeEventListener('pagehide', onPagehide);
      recoveryTracker.stop();
    };
  });

  function restore(): void {
    if (recoveryRecord === undefined) return;
    const formEl = document.getElementById(formId) as HTMLFormElement | null;
    if (formEl === null) return;
    restoreCandidateToForm(formEl, recoveryRecord.candidate);
    onRestored?.();
  }
</script>

{#if unavailable}
  <section class="studio-recovery-copy" aria-labelledby="studio-recovery-copy-heading">
    <h3 id="studio-recovery-copy-heading">Browser recovery unavailable</h3>
    <p>
      Recovery copy is disabled in this session because browser storage is unavailable. The full
      server workflow is unaffected.
    </p>
  </section>
{:else if recoveryRecord}
  <section class="studio-recovery-copy" aria-labelledby="studio-recovery-copy-heading">
    <h3 id="studio-recovery-copy-heading">Recovery copy</h3>
    <p>
      <strong>Not saved yet.</strong>
      {#if reconciliation === 'matching'}
        A browser-held copy of your unsaved input matches the evidence you loaded. It is never
        canonical and never publishable; restore only if you choose to resume it.
      {:else}
        A browser-held copy of your unsaved input was captured against earlier evidence. Fresh
        server content is shown first; compare before restoring. It is never canonical and never
        publishable.
      {/if}
    </p>
    {#if reconciliation === 'matching'}
      <button type="button" onclick={restore}>Restore recovery copy</button>
    {:else if !comparing}
      <button type="button" onclick={() => (comparing = true)}>Compare/Restore</button>
    {:else}
      <div class="studio-recovery-copy__comparison" aria-label="Recovery comparison">
        <p><strong>Recovery candidate</strong></p>
        <p>{recoveryRecord.candidate.metadata.title}</p>
        <pre>{recoveryRecord.candidate.body}</pre>
        <dl>
          <dt>Recovery base</dt>
          <dd>{recoveryRecord.loadedConcurrency.baseMainSha}</dd>
          <dt>Current base</dt>
          <dd>{loadedConcurrency.baseMainSha}</dd>
          {#if recoveryRecord.loadedConcurrency.draftHeadSha}
            <dt>Recovery draft</dt>
            <dd>{recoveryRecord.loadedConcurrency.draftHeadSha}</dd>
          {/if}
          {#if loadedConcurrency.draftHeadSha}
            <dt>Current draft</dt>
            <dd>{loadedConcurrency.draftHeadSha}</dd>
          {/if}
        </dl>
      </div>
      <button type="button" onclick={restore}>Restore recovery copy</button>
    {/if}
  </section>
{/if}

<style>
  .studio-recovery-copy {
    display: grid;
    gap: var(--studio-space-2);
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  .studio-recovery-copy > :first-child {
    margin-top: 0;
  }

  .studio-recovery-copy > :last-child {
    margin-bottom: 0;
  }

  .studio-recovery-copy p {
    margin: 0;
    font-size: var(--studio-text-compact);
  }

  .studio-recovery-copy__comparison {
    min-width: 0;
    padding: var(--studio-space-2);
    overflow-wrap: anywhere;
    background: var(--studio-panel);
    border-radius: var(--studio-radius-control);
  }

  .studio-recovery-copy__comparison pre {
    max-height: 16rem;
    overflow: auto;
    white-space: pre-wrap;
  }

  .studio-recovery-copy button {
    justify-self: start;
    border: 1px solid var(--studio-link);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2) var(--studio-space-3);
    background: transparent;
    color: var(--studio-link);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
