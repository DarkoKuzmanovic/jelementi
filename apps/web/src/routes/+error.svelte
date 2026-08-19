<script lang="ts">
  import { page } from '$app/state';
  import ReaderRecovery from './(reader)/ReaderRecovery.svelte';
  import ReaderShell from './(reader)/ReaderShell.svelte';
  import { recoveryRetryHref } from './(reader)/reader-recovery';

  const retryHref = $derived(recoveryRetryHref(page.status, page.url));
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} — Jelementi</title>
</svelte:head>
<ReaderShell>
  <ReaderRecovery status={page.status} {retryHref} />
</ReaderShell>
