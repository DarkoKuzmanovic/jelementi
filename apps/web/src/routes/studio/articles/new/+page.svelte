<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import StudioEditorialDesk from '../../../../lib/studio/StudioEditorialDesk.svelte';
  import StudioPreviewPane from '../../../../lib/studio/StudioPreviewPane.svelte';
  import StudioNewArticlePublicationCenter from '../../../../lib/studio/StudioNewArticlePublicationCenter.svelte';
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

<StudioEditorialDesk>
  {#snippet editor()}
    <StudioEditor
      editor={data.editor}
      submitted={previewAction?.editor ?? saveAction?.editor}
      save={saveAction?.save}
    />
  {/snippet}

  {#snippet preview()}
    <StudioPreviewPane preview={previewAction?.preview} />
  {/snippet}

  {#snippet publication()}
    <StudioNewArticlePublicationCenter concurrency={data.editor.concurrency} />
  {/snippet}
</StudioEditorialDesk>
