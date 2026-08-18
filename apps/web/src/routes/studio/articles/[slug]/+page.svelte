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
    studioRecoveryKey,
    type StudioRecoveryStore,
  } from '../../../../lib/studio/enhancement-recovery';
  import type { StudioRecoveryTracker } from '../../../../lib/studio/studio-enhancement-controller';
  import {
    applyStudioConcurrencyToForm,
    buildCheckControllerOptions,
    buildEditorControllerOptions,
    installStudioEnhancement,
    toStudioActionResponse,
    type StudioRawActionResponse,
  } from '../../../../lib/studio/studio-enhancement-page';
  import type { StudioActionEnvelope } from '../../../../lib/studio/action-envelope';
  import type { StudioWorkspaceProjection } from '../../../../lib/studio/workspace-projection';
  import type { StudioPreviewResult } from '../../../../lib/studio/contracts';
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

  // Refresh re-reads GitHub AND re-runs probes; its result replaces the
  // loaded status until the page is reloaded. There is no background
  // polling — this is the only way `status` changes without a reload.
  const status = $derived(replacementAction?.status ?? refreshAction?.status ?? data.status);

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
      createStudioRecoveryStore(sessionStorage).clear(studioRecoveryKey(data.editor.metadata.slug));
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
    };
  });

  function handleActionEnvelope(
    envelope: StudioActionEnvelope,
    _actionData: unknown,
    liveMatches: boolean,
  ): void {
    if (envelope.kind === 'preview') {
      previewOverride = envelope.preview;
      return;
    }
    if (envelope.kind === 'save') {
      saveOverride = envelope.save;
      workspaceOverride = envelope.workspace;
      validationOverride = envelope.validation;
      validationOverrideSet = true;
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
    <StudioPreviewPane preview={previewOverride ?? previewAction?.preview} />
  {/snippet}

  {#snippet publication()}
    <aside id="publication-center" aria-labelledby="studio-publication-center-heading">
      <h2 id="studio-publication-center-heading">Publication center</h2>
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
