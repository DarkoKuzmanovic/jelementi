<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import StudioPublishPanel from '../../../../lib/studio/StudioPublishPanel.svelte';
  import StudioEditorialDesk from '../../../../lib/studio/StudioEditorialDesk.svelte';
  import StudioPreviewPane from '../../../../lib/studio/StudioPreviewPane.svelte';
  import StudioLifecycleSummary from '../../../../lib/studio/StudioLifecycleSummary.svelte';
  import StudioEvidenceDisclosure from '../../../../lib/studio/StudioEvidenceDisclosure.svelte';
  import StudioStatusAnnouncer from '../../../../lib/studio/StudioStatusAnnouncer.svelte';
  import { buildStudioWorkspaceProjection } from '../../../../lib/studio/workspace-projection';
  import { studioEditorCandidateEquals } from '../../../../lib/studio/editorial-candidate';
  import type {
    StudioDraftReplacementActionData,
    StudioPreviewActionData,
    StudioSaveActionData,
  } from '../../../../lib/server/studio/editor-route.server';
  import type { StudioPublishActionData, StudioRefreshActionData } from './+page.server';
  import type { StudioUnpublishActionData, StudioDiscardActionData } from './+page.server';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const previewAction = $derived(
    form && typeof form === 'object' && 'preview' in form
      ? (form as StudioPreviewActionData)
      : undefined,
  );
  const saveAction = $derived(
    form && typeof form === 'object' && 'save' in form ? (form as StudioSaveActionData) : undefined,
  );
  const replacementAction = $derived(
    form && typeof form === 'object' && 'replacement' in form
      ? (form as StudioDraftReplacementActionData)
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
    submittedCandidate !== undefined &&
      !studioEditorCandidateEquals(submittedCandidate, data.editor),
  );

  // Server-authored composite view above `status`: this route never ships
  // client JS (`csr = false`), so this is computed during SSR only, never
  // in the browser. It composes the existing lifecycle result, it never
  // replaces it (#73).
  const workspace = $derived(buildStudioWorkspaceProjection(status, data.editor.concurrency));
</script>

<StudioStatusAnnouncer politeMessage={workspace.summary} />

<StudioEditorialDesk>
  {#snippet editor()}
    <StudioEditor
      editor={data.editor}
      submitted={submittedCandidate}
      save={saveAction?.save}
      replacement={replacementAction?.replacement}
    />
  {/snippet}

  {#snippet preview()}
    <StudioPreviewPane preview={previewAction?.preview} />
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
      </div>
      <div id="recovery">
        <StudioPublishPanel
          {status}
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
</style>
