<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
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
</script>

<StudioEditor
  editor={data.editor}
  submitted={previewAction?.editor ?? saveAction?.editor}
  preview={previewAction?.preview}
  save={saveAction?.save}
/>
