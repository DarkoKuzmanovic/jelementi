<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import StudioPublishPanel from '../../../../lib/studio/StudioPublishPanel.svelte';
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
</script>

<StudioEditor
  editor={data.editor}
  submitted={previewAction?.editor ?? saveAction?.editor ?? replacementAction?.editor}
  preview={previewAction?.preview}
  save={saveAction?.save}
  replacement={replacementAction?.replacement}
/>

<StudioPublishPanel
  {status}
  publish={publishAction?.publish}
  unpublish={unpublishAction?.unpublish}
  discard={discardAction?.discard}
/>
