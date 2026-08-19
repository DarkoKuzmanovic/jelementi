<script lang="ts">
  import { page } from '$app/state';
  import ReaderRecovery from './ReaderRecovery.svelte';
  import { recoveryRetryHref } from './reader-recovery';

  const retryHref = $derived(recoveryRetryHref(page.status, page.url));
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} — Jelementi</title>
</svelte:head>
<ReaderRecovery status={page.status} {retryHref} />
