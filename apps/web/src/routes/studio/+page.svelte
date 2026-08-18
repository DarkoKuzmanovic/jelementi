<script lang="ts">
  import StudioDraftDiscardedNotice from '$lib/studio/StudioDraftDiscardedNotice.svelte';
  import StudioFlowboard from '$lib/studio/StudioFlowboard.svelte';
  import StudioStatusAnnouncer from '$lib/studio/StudioStatusAnnouncer.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData | null } = $props();
  const flowboard = $derived(form?.flowboard ?? data.flowboard);
  const statusMessage = $derived(
    form?.checkedSlug === undefined ? '' : `Status checked for ${form.checkedSlug}.`,
  );
</script>

<StudioStatusAnnouncer politeMessage={statusMessage} />
{#if data.outcome === 'draft-discarded'}
  <StudioDraftDiscardedNotice />
{/if}
<StudioFlowboard {flowboard} />
