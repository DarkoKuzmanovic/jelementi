<script lang="ts">
  import { onMount } from 'svelte';
  import { deserialize as deserializeFromApp } from '$app/forms';
  import StudioDraftDiscardedNotice from '$lib/studio/StudioDraftDiscardedNotice.svelte';
  import StudioFlowboard from '$lib/studio/StudioFlowboard.svelte';
  import StudioStatusAnnouncer from '$lib/studio/StudioStatusAnnouncer.svelte';
  import type { StudioFlowboardProjection } from '$lib/studio/flowboard-projection';
  import {
    createStudioRecoveryStore,
    studioPersistentStorage,
    studioRecoveryKey,
  } from '$lib/studio/enhancement-recovery';
  import {
    buildCheckControllerOptions,
    installStudioEnhancement,
    toStudioActionResponse,
    type StudioRawActionResponse,
  } from '$lib/studio/studio-enhancement-page';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData | null } = $props();

  // #78 enhancement: an authoritative Check status response replaces the
  // complete server-authored Flowboard projection (columns + counts) — the
  // browser never reclassifies a card. Full navigation still re-renders via
  // `form`; the override wins only for the enhanced in-place path.
  let flowboardOverride = $state<StudioFlowboardProjection | null>(null);
  const flowboard = $derived(flowboardOverride ?? form?.flowboard ?? data.flowboard);
  let checkedSlugOverride = $state<string | undefined>(undefined);
  const checkedSlug = $derived(checkedSlugOverride ?? form?.checkedSlug);
  const statusMessage = $derived(
    checkedSlug === undefined ? '' : `Status checked for ${checkedSlug}.`,
  );
  let politeOverride = $state('');
  let assertiveMessage = $state('');
  let disabledMessage = $state('');
  let completionUnknown = $state('');

  onMount(() => {
    if (data.discardedSlug !== undefined) {
      // #112: recovery records persist in localStorage now, so the discard
      // outcome must clear from the same persistent backend.
      createStudioRecoveryStore(studioPersistentStorage()).clear(
        studioRecoveryKey(data.discardedSlug),
      );
    }
    const cleanups: Array<() => void> = [];
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>('form[action="?/check"]'));
    for (const formEl of forms) {
      const slug = formEl.querySelector<HTMLInputElement>('input[name="slug"]')?.value ?? '';
      const cleanup = installStudioEnhancement(
        formEl,
        buildCheckControllerOptions(formEl, slug, {
          deserialize: (text) =>
            toStudioActionResponse(deserializeFromApp(text) as unknown as StudioRawActionResponse),
          announcePolite: (message) => {
            // The check-specific "Status checked for …" announcement is set
            // by the envelope callback (and the derived statusMessage); the
            // generic success message must not clobber it. Only the pending
            // notice is kept here.
            if (message === 'Submitting…') politeOverride = message;
          },
          announceAssertive: (message) => {
            assertiveMessage = message;
          },
          onCompletionUnknown: () => {
            completionUnknown =
              'Completion unknown — the check may or may not have run. Nothing was retried automatically.';
          },
          onStateChanged: (state) => {
            disabledMessage = state.disabled
              ? 'Enhanced Check status is disabled for this form for this session; the full-page form still works.'
              : '';
          },
          onRedirect: (location) => {
            window.location.assign(location);
          },
          onActionEnvelope: () => {
            /* Flowboard checks deliver the flowboard envelope, not an action envelope. */
          },
          onFlowboardEnvelope: (envelope) => {
            flowboardOverride = envelope.flowboard;
            checkedSlugOverride = envelope.checkedSlug;
            politeOverride = `Status checked for ${envelope.checkedSlug}.`;
          },
        }),
        {},
      );
      cleanups.push(() => cleanup.destroy());
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });
</script>

<StudioStatusAnnouncer politeMessage={politeOverride || statusMessage} {assertiveMessage} />
{#if data.outcome === 'draft-discarded'}
  <StudioDraftDiscardedNotice />
{/if}
{#if completionUnknown}
  <p class="studio-enhancement-notice" role="status">{completionUnknown}</p>
{/if}
{#if disabledMessage}
  <p class="studio-enhancement-notice" role="status">{disabledMessage}</p>
{/if}
<StudioFlowboard {flowboard} />

<style>
  .studio-enhancement-notice {
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }
</style>
