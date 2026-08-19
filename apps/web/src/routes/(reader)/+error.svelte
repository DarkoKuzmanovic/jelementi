<script lang="ts">
  import { page } from '$app/state';
  import ReaderRecovery from './ReaderRecovery.svelte';

  const retryable = $derived(page.status === 502 || page.status === 503 || page.status === 504);
  const retryHref = $derived(retryable ? `${page.url.pathname}${page.url.search}` : undefined);
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} — Jelementi</title>
</svelte:head>
<ReaderRecovery status={page.status} {retryHref} />
