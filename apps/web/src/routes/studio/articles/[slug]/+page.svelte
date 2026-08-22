<script lang="ts">
  import { onMount } from 'svelte';
  import { deserialize as deserializeFromApp } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import StudioPublishPanel from '../../../../lib/studio/StudioPublishPanel.svelte';
  import StudioEditorialDesk from '../../../../lib/studio/StudioEditorialDesk.svelte';
  import StudioPreviewPane from '../../../../lib/studio/StudioPreviewPane.svelte';
  import StudioLifecycleSummary from '../../../../lib/studio/StudioLifecycleSummary.svelte';
  import StudioEvidenceDisclosure from '../../../../lib/studio/StudioEvidenceDisclosure.svelte';
  import StudioStatusAnnouncer from '../../../../lib/studio/StudioStatusAnnouncer.svelte';
  import StudioValidationSummary from '../../../../lib/studio/StudioValidationSummary.svelte';
  import StudioRecoveryPanel from '../../../../lib/studio/StudioRecoveryPanel.svelte';
  import StudioRecoveryCopyPanel from '../../../../lib/studio/StudioRecoveryCopyPanel.svelte';
  import { buildStudioRecoveryProjection } from '../../../../lib/studio/recovery-projection';
  import { buildStudioWorkspaceProjection } from '../../../../lib/studio/workspace-projection';
  import { studioEditorCandidateEquals } from '../../../../lib/studio/editorial-candidate';
  import {
    createStudioRecoveryStore,
    studioPersistentStorage,
    studioRecoveryKey,
    type StudioRecoveryStore,
  } from '../../../../lib/studio/enhancement-recovery';
  import {
    installStudioUnsavedGuard,
    type StudioUnsavedGuard,
  } from '../../../../lib/studio/unsaved-guard';
  import type { StudioRecoveryTracker } from '../../../../lib/studio/studio-enhancement-controller';
  import {
    applyStudioConcurrencyToForm,
    buildCheckControllerOptions,
    buildEditorControllerOptions,
    installStudioEnhancement,
    schedulePreviewHeadingFocus,
    toStudioActionResponse,
    type StudioRawActionResponse,
  } from '../../../../lib/studio/studio-enhancement-page';
  import type { StudioActionEnvelope } from '../../../../lib/studio/action-envelope';
  import type { StudioWorkspaceProjection } from '../../../../lib/studio/workspace-projection';
  import type { StudioPreviewResult, StudioLifecycle } from '../../../../lib/studio/contracts';
  import { decodeStudioLifecycle } from '../../../../lib/studio/contracts';
  import type {
    StudioDraftReplacementActionData,
    StudioPreviewActionData,
    StudioSaveActionData,
  } from '../../../../lib/server/studio/editor-route.server';
  import type { StudioValidationProjection } from '../../../../lib/server/studio/validation-projection.server';
  import type { StudioPublishActionData, StudioRefreshActionData } from './+page.server';
  import type { StudioUnpublishActionData, StudioDiscardActionData } from './+page.server';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const previewAction = $derived(
    form && typeof form === 'object' && 'preview' in form
      ? (form as StudioPreviewActionData)
      : undefined,
  );
  const saveAction = $derived(
    form && typeof form === 'object' && 'save' in form
      ? (form as StudioSaveActionData & { validation?: StudioValidationProjection })
      : undefined,
  );
  const replacementAction = $derived(
    form && typeof form === 'object' && 'replacement' in form
      ? (form as StudioDraftReplacementActionData & {
          validation?: StudioValidationProjection;
        })
      : undefined,
  );
  const publishAction = $derived(
    form && typeof form === 'object' && 'publish' in form
      ? (form as StudioPublishActionData)
      : undefined,
  );
  const refreshAction = $derived(
    form && typeof form === 'object' && 'status' in form
      ? (form as StudioRefreshActionData)
      : undefined,
  );
  const unpublishAction = $derived(
    form && typeof form === 'object' && 'unpublish' in form
      ? (form as StudioUnpublishActionData)
      : undefined,
  );
  const discardAction = $derived(
    form && typeof form === 'object' && 'discard' in form
      ? (form as StudioDiscardActionData)
      : undefined,
  );

  // #78 enhanced regions. Only result regions update in place; live form
  // values are never replaced by an authoritative response.
  let previewOverride = $state<StudioPreviewResult | undefined>(undefined);
  let workspaceOverride = $state<StudioWorkspaceProjection | undefined>(undefined);
  let saveOverride = $state<StudioSaveActionData['save'] | undefined>(undefined);
  // #115: the enhanced Save response's synthesized post-save lifecycle.
  // Like every result override it survives until a full navigation remounts
  // the page; only authoritative save envelopes ever write it.
  let statusOverride = $state<StudioLifecycle | undefined>(undefined);
  let liveCandidateDirty = $state(false);
  let politeOverride = $state('');
  let assertiveMessage = $state('');
  let disabledMessage = $state('');
  let completionUnknown = $state('');
  let editorFormEl: HTMLFormElement | undefined;
  let validationOverride = $state<StudioValidationProjection | undefined>(undefined);
  let validationOverrideSet = $state(false);
  let recoveryDeps:
    | {
        store: StudioRecoveryStore;
        tracker: StudioRecoveryTracker;
        key: string;
        clearRecord(): void;
      }
    | undefined;
  // #112: native leave confirmation, registered only while the candidate
  // is dirty. $state so the sync effect also runs when the guard mounts.
  let unsavedGuard = $state<StudioUnsavedGuard | undefined>(undefined);
  // #114: true once the form changed after the snapshot the displayed
  // preview was rendered from. Cleared by each authoritative preview
  // result; announced politely on the false→true transition only, so a
  // burst of typing never spams the status region.
  let previewStale = $state(false);

  // Refresh re-reads GitHub AND re-runs probes; its result replaces the
  // loaded status until the page is reloaded. #115: so does a successful
  // Save — its synthesized post-save lifecycle is authoritative without a
  // Check-status click or reload, in both delivery paths (enhanced
  // override and full-navigation action result). There is no background
  // polling; these are the only ways `status` changes without a reload.
  const status = $derived(
    statusOverride ??
      replacementAction?.status ??
      saveAction?.status ??
      refreshAction?.status ??
      data.status,
  );

  const submittedCandidate = $derived(
    previewAction?.editor ??
      saveAction?.editor ??
      replacementAction?.editor ??
      publishAction?.editor,
  );
  const candidateDirty = $derived(
    liveCandidateDirty ||
      (submittedCandidate !== undefined &&
        !studioEditorCandidateEquals(submittedCandidate, data.editor)),
  );

  // Server-authored composite view above `status`. This route now hydrates
  // (`csr = true`, #77) so validation issue links can focus their target
  // control and select body ranges; the projection itself still composes
  // the existing lifecycle result, it never replaces it (#73).
  const workspace = $derived(
    workspaceOverride ?? buildStudioWorkspaceProjection(status, data.editor.concurrency),
  );

  // #77: validation comes from the server (action result first, else the
  // load's committed-draft projection); recovery is derived from whichever
  // operation result the form carries. Replacement wins over publish over
  // save — the most recent authoritative operation owns the presentation.
  const validation = $derived(
    validationOverrideSet
      ? validationOverride
      : (saveAction?.validation ??
          replacementAction?.validation ??
          publishAction?.validation ??
          previewAction?.validation ??
          data.validation),
  );
  const recovery = $derived(
    buildStudioRecoveryProjection({
      save: saveOverride ?? saveAction?.save,
      publish: publishAction?.publish,
      replacement: replacementAction?.replacement,
    }),
  );

  onMount(() => {
    const formEl = document.getElementById('studio-article-form') as HTMLFormElement | null;
    if (formEl === null) return;
    editorFormEl = formEl;
    if (discardAction?.discard.kind === 'discarded') {
      createStudioRecoveryStore(studioPersistentStorage()).clear(
        studioRecoveryKey(data.editor.metadata.slug),
      );
    }

    const editorCleanup = installStudioEnhancement(
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
            'Completion unknown — your work is preserved. Nothing was retried automatically; use Check status or submit again.';
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
    // pane stale. The recovery panel and the unsaved guard keep their own
    // listeners; this one only feeds the out-of-date indicator.
    const markPreviewStale = (): void => {
      if (!previewStale && (previewOverride ?? previewAction?.preview) !== undefined) {
        politeOverride = 'Preview is out of date.';
      }
      previewStale = true;
    };
    formEl.addEventListener('input', markPreviewStale);

    const checkForm = document.querySelector<HTMLFormElement>('form[action="?/refresh"]');
    const checkCleanup =
      checkForm === null
        ? undefined
        : installStudioEnhancement(
            checkForm,
            buildCheckControllerOptions(checkForm, data.editor.metadata.slug, {
              deserialize: (text) =>
                toStudioActionResponse(
                  deserializeFromApp(text) as unknown as StudioRawActionResponse,
                ),
              announcePolite: (message) => {
                politeOverride = message;
              },
              announceAssertive: (message) => {
                assertiveMessage = message;
              },
              onCompletionUnknown: () => {
                completionUnknown =
                  'Completion unknown — the check may or may not have run. Nothing was retried automatically; use the full-page Check status if needed.';
              },
              onStateChanged: (state) => {
                disabledMessage = state.disabled
                  ? 'Enhanced Check status is disabled for this form for this session; the full-page form still works.'
                  : '';
              },
              onRedirect: (location) => {
                window.location.assign(location);
              },
              onActionEnvelope: handleActionEnvelope,
            }),
            {},
          );

    return () => {
      editorFormEl = undefined;
      editorCleanup.destroy();
      checkCleanup?.destroy();
      formEl.removeEventListener('input', markPreviewStale);
    };
  });

  // #112: the native leave confirmation follows the dirty flag exactly —
  // a clean editor never registers an unload handler, and same-page form
  // submissions are exempt inside the guard (Save persists server-side;
  // Preview/Save candidates are already flushed to the recovery record on
  // `pagehide`).
  onMount(() => {
    const guard = installStudioUnsavedGuard();
    unsavedGuard = guard;
    return () => {
      unsavedGuard = undefined;
      guard.destroy();
    };
  });

  $effect(() => {
    unsavedGuard?.setDirty(candidateDirty);
  });

  /**
   * #115: the save action result's synthesized `status` field (absent for
   * outcomes that mutated nothing). Read from the raw action data — the
   * established channel for server-authored envelope companions
   * (`acceptedSlug`) — and handed to `decodeStudioLifecycle` by the caller,
   * so nothing unbounded is ever applied.
   */
  function actionDataStatusOf(actionData: unknown): unknown {
    if (typeof actionData !== 'object' || actionData === null || !('status' in actionData)) {
      return undefined;
    }
    return (actionData as { status?: unknown }).status;
  }

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
        validationOverrideSet = true;
      }
      // #114: the rendered snapshot is exactly the submitted one. When the
      // live form already moved past it (typing during the request), the
      // pane starts out stale; otherwise a fresh result clears the mark.
      previewStale = !liveMatches;
      // Focus follows only when the user is still on the submitted
      // snapshot — yanking focus mid-typing would steal the caret from
      // newer input. The "your newer typing was kept" announcement covers
      // that case instead.
      if (liveMatches) schedulePreviewHeadingFocus();
      return;
    }
    if (envelope.kind === 'save') {
      saveOverride = envelope.save;
      workspaceOverride = envelope.workspace;
      validationOverride = envelope.validation;
      validationOverrideSet = true;
      // #115: the same response carries the synthesized post-save lifecycle
      // (server-authored next to the save result, like `acceptedSlug`).
      // Applied through the strict lifecycle decoder so an unexpected shape
      // is dropped rather than trusted; when present it advances the page's
      // derived status immediately, so Publish unlocks without a reload or
      // Check-status click and both invalid surfaces flip together.
      const postSave = decodeStudioLifecycle(actionDataStatusOf(actionData));
      if (postSave.ok) {
        statusOverride = postSave.value;
      }
      if (editorFormEl !== undefined) {
        applyStudioConcurrencyToForm(editorFormEl, envelope.workspace.concurrency);
      }
      // Save clears only the submitted snapshot: when the live form still
      // equals the submitted candidate, the matching recovery record is
      // cleared. Newer typing stays dirty and recoverable.
      if (envelope.save.kind === 'saved' && liveMatches) {
        recoveryDeps?.clearRecord();
        liveCandidateDirty = false;
      }
      return;
    }
    if (envelope.kind === 'check_status') {
      workspaceOverride = envelope.workspace;
      // #116 coherence (folds the T115-adjacent gap): the same authoritative
      // response carries the refreshed lifecycle next to its workspace
      // projection. Applied through the strict lifecycle decoder so an
      // unexpected shape is dropped rather than trusted; without this, the
      // publication panel kept its pre-check status while the projection
      // above it already showed fresh evidence.
      const refreshed = decodeStudioLifecycle(actionDataStatusOf(actionData));
      if (refreshed.ok) {
        statusOverride = refreshed.value;
      }
      if (editorFormEl !== undefined) {
        applyStudioConcurrencyToForm(editorFormEl, envelope.workspace.concurrency);
      }
    }
  }
</script>

<StudioStatusAnnouncer politeMessage={politeOverride || workspace.summary} {assertiveMessage} />

<StudioEditorialDesk>
  {#snippet editor()}
    <StudioEditor
      editor={data.editor}
      submitted={submittedCandidate}
      save={saveOverride ?? saveAction?.save}
      replacement={replacementAction?.replacement}
      recoveryPresentation="external"
    />
  {/snippet}

  {#snippet preview()}
    <StudioPreviewPane preview={previewOverride ?? previewAction?.preview} stale={previewStale} />
  {/snippet}

  {#snippet publication()}
    <aside id="publication-center" aria-labelledby="studio-publication-center-heading">
      <h2 id="studio-publication-center-heading" class="studio-column-caption">
        Publication center
      </h2>
      {#if candidateDirty}
        <section class="studio-dirty-notice" aria-labelledby="studio-dirty-heading">
          <h3 id="studio-dirty-heading">Unsaved form changes</h3>
          <p>
            Not saved yet. The committed Studio draft is still safe; save the current form before
            publishing.
          </p>
        </section>
      {/if}
      <div id="validation-summary">
        <StudioLifecycleSummary projection={workspace} />
        <StudioValidationSummary {validation} />
      </div>
      <div id="recovery">
        <StudioRecoveryPanel {recovery} />
        <StudioRecoveryCopyPanel
          identity={data.editor.metadata.slug}
          loadedConcurrency={data.editor.concurrency}
          onRestored={() => {
            politeOverride = 'Recovery copy restored.';
          }}
          onReady={(deps) => {
            recoveryDeps = deps;
          }}
          onCandidateChange={(candidate) => {
            liveCandidateDirty =
              candidate !== undefined && !studioEditorCandidateEquals(candidate, data.editor);
          }}
        />
        <StudioPublishPanel
          {status}
          concurrency={workspace.concurrency}
          {candidateDirty}
          publish={publishAction?.publish}
          unpublish={unpublishAction?.unpublish}
          discard={discardAction?.discard}
        />
      </div>
      <StudioEvidenceDisclosure projection={workspace} />
    </aside>
  {/snippet}
</StudioEditorialDesk>

{#if completionUnknown}
  <p class="studio-enhancement-notice" role="status">{completionUnknown}</p>
{/if}
{#if disabledMessage}
  <p class="studio-enhancement-notice" role="status">{disabledMessage}</p>
{/if}

<style>
  .studio-dirty-notice {
    margin-bottom: var(--studio-space-3);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
  }

  .studio-dirty-notice > :first-child {
    margin-top: 0;
  }

  .studio-dirty-notice > :last-child {
    margin-bottom: 0;
  }

  .studio-enhancement-notice {
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }
</style>
