<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import StudioEditor from '../../../../lib/studio/StudioEditor.svelte';
  import type { StudioPreviewActionData } from '../../../../lib/server/studio/editor-route.server';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const action = $derived(
    form && typeof form === 'object' && 'preview' in form
      ? (form as StudioPreviewActionData)
      : undefined,
  );
</script>

<StudioEditor editor={data.editor} submitted={action?.editor} preview={action?.preview} />
