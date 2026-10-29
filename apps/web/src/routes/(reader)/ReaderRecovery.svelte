<script lang="ts">
  let { status, retryHref }: { status: number; retryHref?: string } = $props();

  const notFound = $derived(status === 404);
</script>

<section class="small-page recovery" aria-labelledby="reader-recovery-heading">
  <p class:recovery__number={notFound} class:reader-kicker={!notFound}>
    {notFound ? '404' : 'Something went wrong'}
  </p>
  <h1 id="reader-recovery-heading">
    {notFound ? 'This page is not available.' : 'The page could not be loaded.'}
  </h1>
  <p class="small-page__deck">
    {notFound
      ? 'The address may be incorrect, or the page may have moved.'
      : retryHref === undefined
        ? 'Use another route to continue reading.'
        : 'Try again. If the problem continues, use another route.'}
  </p>
  {#if notFound}
    <form class="search-form" role="search" aria-label="Page search" action="/search" method="get">
      <div class="search-form__row">
        <button type="submit" aria-label="Search stories"
          ><svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"><circle cx="7" cy="7" r="6" /><path d="m11.5 11.5 4.5 4.5" /></svg
          ></button
        >
        <input
          type="search"
          name="query"
          aria-label="Search stories"
          placeholder="Search stories"
        />
      </div>
    </form>
  {/if}
  <nav class="home-actions" aria-label={notFound ? 'Page recovery' : 'Error recovery'}>
    {#if retryHref !== undefined}<a class="reader-button" href={retryHref}>Try again</a>{/if}
    <a class="reader-button" href="/">Home</a>
    {#if !notFound}<a class="reader-button reader-button--secondary" href="/search">Search</a>{/if}
    <a class="reader-button reader-button--secondary" href="/categories">Sections</a>
  </nav>
</section>
