<script lang="ts">
  import { page } from '$app/state';
  import ReaderRecovery from './(reader)/ReaderRecovery.svelte';
  import ReaderShell from './(reader)/ReaderShell.svelte';

  const studioPath = $derived(
    page.url.pathname === '/studio' || page.url.pathname.startsWith('/studio/'),
  );
  const retryable = $derived(page.status === 502 || page.status === 503 || page.status === 504);
  const retryHref = $derived(retryable ? `${page.url.pathname}${page.url.search}` : undefined);
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} — Jelementi</title>
</svelte:head>
{#if studioPath}
  <section aria-labelledby="error-heading">
    <h1 id="error-heading">{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
    <p>
      {page.status === 404
        ? 'The page you requested is not available.'
        : page.error?.message || 'Please try again later.'}
    </p>
    <p><a href="/studio">Return to Studio</a></p>
  </section>
{:else}
  <ReaderShell>
    <ReaderRecovery status={page.status} {retryHref} />
  </ReaderShell>
{/if}
