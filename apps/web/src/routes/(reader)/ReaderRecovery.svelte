<script lang="ts">
  let { status, retryHref }: { status: number; retryHref?: string } = $props();

  const notFound = $derived(status === 404);
</script>

<section class="recovery" aria-labelledby="reader-recovery-heading">
  <p class="recovery__context">{notFound ? 'Page not found' : 'Something went wrong'}</p>
  <h1 id="reader-recovery-heading">
    {notFound ? 'This page is not available.' : 'The page could not be loaded.'}
  </h1>
  <p>
    {notFound
      ? 'The address may be incorrect, or the page may have moved.'
      : retryHref === undefined
        ? 'Use another route to continue reading.'
        : 'Try again. If the problem continues, use another route.'}
  </p>
  <nav aria-label={notFound ? 'Page recovery' : 'Error recovery'}>
    {#if retryHref !== undefined}<a href={retryHref}>Try again</a>{/if}
    <a href="/">Home</a>
    <a href="/search">Search</a>
    <a href="/categories">Categories</a>
  </nav>
</section>

<style>
  .recovery {
    max-width: 34rem;
    overflow-wrap: anywhere;
  }

  .recovery__context {
    margin: 0 0 var(--space-2);
    color: var(--foundation-muted);
    font-size: var(--text-small);
    font-weight: 700;
  }

  .recovery h1 {
    margin: 0;
  }

  .recovery nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-6);
    margin-top: var(--space-6);
  }
</style>
