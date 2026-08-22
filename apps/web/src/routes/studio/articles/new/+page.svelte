<script lang="ts">
  import { onMount } from 'svelte';
  import { deserialize as deserializeFromApp } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import StudioEditorialDesk from '../../../../lib/studio/StudioEditorialDesk.svelte';
  import StudioPreviewPane from '../../../../lib/studio/StudioPreviewPane.svelte';
  import StudioStatusAnnouncer from '../../../../lib/studio/StudioStatusAnnouncer.svelte';
  import StudioRecoveryCopyPanel from '../../../../lib/studio/StudioRecoveryCopyPanel.svelte';
  import StudioNewArticlePublicationCenter from '../../../../lib/studio/StudioNewArticlePublicationCenter.svelte';
  import StudioValidationSummary from '../../../../lib/studio/StudioValidationSummary.svelte';
  import {
    studioRecoveryKey,
    STUDIO_RECOVERY_NEW_IDENTITY,
    type StudioRecoveryStore,
  } from '../../../../lib/studio/enhancement-recovery';
  import type { StudioRecoveryTracker } from '../../../../lib/studio/studio-enhancement-controller';
  import {
    buildEditorControllerOptions,
    installStudioEnhancement,
    schedulePreviewHeadingFocus,
    toStudioActionResponse,
    type StudioRawActionResponse,
  } from '../../../../lib/studio/studio-enhancement-page';
  import type { StudioActionEnvelope } from '../../../../lib/studio/action-envelope';
  import type { StudioPreviewResult } from '../../../../lib/studio/contracts';
  import type { StudioSaveResult } from '../../../../lib/server/studio/editor.server';
  import type { StudioValidationProjection } from '../../../../lib/server/studio/validation-projection.server';
  import type {
    StudioPreviewActionData,
    StudioSaveActionData,
  } from '../../../../lib/server/studio/editor-route.server';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const previewAction = $derived(
    form && typeof form === 'object' && 'preview' in form
      ? (form as StudioPreviewActionData)
      : undefined,
  );
  const saveAction = $derived(
    form && typeof form === 'object' && 'save' in form ? (form as StudioSaveActionData) : undefined,
  );

  // #78 enhanced regions. Only these result regions update in place; form
  // values are never replaced by an authoritative response. Recovery-copy
  // state is owned by StudioRecoveryCopyPanel (its own reactive scope), so
  // keystrokes never re-render the editor form.
  let previewOverride = $state<StudioPreviewResult | undefined>(undefined);
  // #109: authoritative Save outcomes (slug-collision rejections, conflicts,
  // failures) must render inline without a navigation — mirroring the
  // established article route's saveOverride wiring. Typed form values are
  // never replaced (#78); only the result region updates.
  let saveOverride = $state<StudioSaveResult | undefined>(undefined);
  // #110: field-anchored validation for Preview/Save responses whose form
  // failed decoding — the new-article route presents the same go-to-field
  // summary as the established route.
  let validationOverride = $state<StudioValidationProjection | undefined>(undefined);
  let politeOverride = $state('');
  let assertiveMessage = $state('');
  let disabledMessage = $state('');
  let completionUnknown = $state('');
  let recoveryDeps:
    | {
        store: StudioRecoveryStore;
        tracker: StudioRecoveryTracker;
        key: string;
        clearRecord(): void;
      }
    | undefined;
  // #114: true once the form changed after the snapshot the displayed
  // preview was rendered from; cleared by each authoritative preview
  // result and announced politely on the false→true transition only.
  let previewStale = $state(false);

  onMount(() => {
    const formEl = document.getElementById('studio-article-form') as HTMLFormElement | null;
    if (formEl === null) return;

    const cleanup = installStudioEnhancement(
      formEl,
      buildEditorControllerOptions(formEl, {
        deserialize: (text) =>
          toStudioActionResponse(deserializeFromApp(text) as unknown as StudioRawActionResponse),
        announcePolite: (message) => {
          politeOverride = message;
        },
        announceAssertive: (message) => {
          assertiveMessage = message;
        },
        onCompletionUnknown: () => {
          completionUnknown =
            'Completion unknown — your work is preserved. Nothing was retried automatically; use the full-page form if needed.';
        },
        onStateChanged: (state) => {
          disabledMessage = state.disabled
            ? 'Enhanced submission is disabled for this form for this session; the full-page form still works.'
            : '';
        },
        onRedirect: (location) => {
          window.location.assign(location);
        },
        onActionEnvelope: handleActionEnvelope,
      }),
      {},
    );

    // #114: any change to the live form after a rendered preview marks the
    // pane stale (the recovery panel keeps its own listener).
    const markPreviewStale = (): void => {
      if (!previewStale && (previewOverride ?? previewAction?.preview) !== undefined) {
        politeOverride = 'Preview is out of date.';
      }
      previewStale = true;
    };
    formEl.addEventListener('input', markPreviewStale);

    return () => {
      formEl.removeEventListener('input', markPreviewStale);
      cleanup.destroy();
    };
  });

  function handleActionEnvelope(
    envelope: StudioActionEnvelope,
    actionData: unknown,
    liveMatches: boolean,
  ): void {
    if (envelope.kind === 'preview') {
      previewOverride = envelope.preview;
      // #110: a Preview whose form failed decoding carries the same
      // field-anchored validation projection as Save. Previews without one
      // leave any displayed validation untouched.
      if (envelope.validation !== undefined) {
        validationOverride = envelope.validation;
      }
      // #114: fresh result clears staleness unless newer typing already
      // moved past the submitted snapshot; focus follows only when the user
      // is still on it (never mid-typing).
      previewStale = !liveMatches;
      if (liveMatches) schedulePreviewHeadingFocus();
      return;
    }
    if (envelope.kind !== 'save') return;
    saveOverride = envelope.save;
    validationOverride = envelope.validation;
    if (envelope.save.kind === 'saved') {
      const acceptedSlug =
        typeof actionData === 'object' &&
        actionData !== null &&
        'acceptedSlug' in actionData &&
        typeof (actionData as { acceptedSlug?: unknown }).acceptedSlug === 'string'
          ? (actionData as { acceptedSlug: string }).acceptedSlug
          : undefined;
      // Save clears only the submitted snapshot: when the live form still
      // equals the submitted candidate, the matching `new` recovery record
      // is cleared. Newer typing stays recoverable.
      if (liveMatches) {
        recoveryDeps?.clearRecord();
      }
      if (acceptedSlug !== undefined) {
        // First successful Save: the server accepts the slug and the
        // workspace moves to the established route. Migrate only the
        // matching `new` recovery record (newer typing, if any) to the
        // accepted slug's key, then navigate — slug authority stays
        // entirely server-side.
        if (!liveMatches && recoveryDeps !== undefined) {
          recoveryDeps.tracker.flush();
          const record = recoveryDeps.store.read(recoveryDeps.key);
          if (record !== undefined) {
            recoveryDeps.store.write(studioRecoveryKey(acceptedSlug), record);
            recoveryDeps.store.clear(recoveryDeps.key);
          }
        }
        window.location.replace(`/studio/articles/${acceptedSlug}`);
      }
    }
  }
</script>

<StudioStatusAnnouncer politeMessage={politeOverride} {assertiveMessage} />

{#if completionUnknown}
  <p class="studio-enhancement-notice" role="status">{completionUnknown}</p>
{/if}
{#if disabledMessage}
  <p class="studio-enhancement-notice" role="status">{disabledMessage}</p>
{/if}

<StudioEditorialDesk>
  {#snippet editor()}
    <StudioEditor
      editor={data.editor}
      submitted={previewAction?.editor ?? saveAction?.editor}
      save={saveOverride ?? saveAction?.save}
    />
  {/snippet}

  {#snippet preview()}
    <StudioPreviewPane preview={previewOverride ?? previewAction?.preview} stale={previewStale} />
  {/snippet}

  {#snippet publication()}
    <StudioNewArticlePublicationCenter concurrency={data.editor.concurrency} />
    <StudioValidationSummary
      validation={validationOverride ?? previewAction?.validation ?? saveAction?.validation}
    />
    <StudioRecoveryCopyPanel
      identity={STUDIO_RECOVERY_NEW_IDENTITY}
      loadedConcurrency={data.editor.concurrency}
      onRestored={() => {
        politeOverride = 'Recovery copy restored.';
      }}
      onReady={(deps) => {
        recoveryDeps = deps;
      }}
    />
  {/snippet}
</StudioEditorialDesk>

<style>
  .studio-enhancement-notice {
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }
</style>
