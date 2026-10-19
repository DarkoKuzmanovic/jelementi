<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { filterArticles } from '$lib/generated-content';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';

  let { data }: { data: PageData } = $props();
  let query = $state('');
  let hasInteracted = $state(false);
  let enhanced = $state(false);
  let searchInput: HTMLInputElement;

  onMount(() => {
    enhanced = true;
  });

  const results = $derived(filterArticles(data.index, query));
  const hasQuery = $derived(query.trim().length > 0);
  const resultStatus = $derived(
    hasInteracted
      ? hasQuery
        ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”.`
        : `All ${results.length} published articles.`
      : '',
  );

  function submitSearch(event: SubmitEvent): void {
    event.preventDefault();
    hasInteracted = true;
    searchInput.focus();
  }

  function clearSearch(): void {
    query = '';
    hasInteracted = true;
    searchInput.focus();
  }
</script>

<svelte:head
  ><title>Search — Jelementi</title><meta
    name="description"
    content="Search Jelementi — browse and filter the complete published catalog."
  /></svelte:head
>
<section
  class="search"
  aria-labelledby="search-heading"
  data-search-enhanced={enhanced ? 'true' : undefined}
>
  <header class="page-intro search__intro">
    <h1 id="search-heading">Find a story.</h1>
    <p>Find a story by subject, place, or a half-remembered detail.</p>
  </header>

  <form class="search-form" role="search" action="/search" method="get" onsubmit={submitSearch}>
    <label class="visually-hidden" for="article-search">Search published articles</label>
    <div class="search-form__row">
      <input
        id="article-search"
        name="query"
        type="search"
        autocomplete="off"
        bind:this={searchInput}
        value={query}
        oninput={(event) => {
          query = event.currentTarget.value;
          hasInteracted = true;
        }}
      />
      <button type="submit" hidden={!enhanced}>Search</button>
    </div>
  </form>

  <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
    {resultStatus}
  </p>
  <noscript>
    <p class="search__notice">
      Filtering needs JavaScript; the complete catalog remains available below.
    </p>
  </noscript>

  {#if results.length === 0}
    <section class="empty-state" aria-labelledby="empty-search-heading">
      <div>
        <h2 id="empty-search-heading">No articles found</h2>
        <p>Try a different search, clear the query, or browse all categories.</p>
        <div class="recovery-links">
          <button type="button" onclick={clearSearch}>Clear search</button>
          <a href="/categories">Browse Categories</a>
        </div>
      </div>
    </section>
  {:else}
    <div class="search-results__heading">
      <p>
        {hasQuery
          ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
          : 'All published articles'}
      </p>
      {#if hasQuery}
        <button type="button" onclick={clearSearch}>Clear search</button>
      {/if}
    </div>
    <ul class="article-list divided-list">
      {#each results as article (article.slug)}
        <li>
          <ArticleSummary {article} />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .search__intro {
    margin-bottom: 2rem;
    border: 0;
    padding: 0;
  }
  .search-form {
    margin-bottom: 2rem;
  }
  .search-form__row {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--foundation-control-border);
    border-radius: 3px;
  }
  .search-form__row:focus-within {
    border-color: var(--foundation-focus);
  }
  .search-form input,
  button {
    min-height: 44px;
    font: inherit;
  }
  .search-form input {
    flex: 1;
    min-width: 0;
    padding: 0.25rem 0.75rem;
    border: 0;
    background: var(--foundation-control-surface);
    color: var(--foundation-control-text);
    font-size: 1.25rem;
  }
  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
    border: 1px solid var(--foundation-control-border);
    border-radius: 3px;
    background: var(--foundation-control-surface);
    color: var(--foundation-control-text);
  }
  .search-form button,
  .empty-state button {
    border-color: var(--foundation-accent);
    background: var(--foundation-accent);
    color: var(--foundation-paper);
  }
  .search-results__heading,
  .recovery-links {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    flex-wrap: wrap;
  }
  .search-results__heading p {
    margin: 0;
    font-size: 0.9375rem;
  }
  .search-results__heading button {
    color: var(--foundation-link);
    border: 0;
    background: none;
    font-size: 0.875rem;
  }
  .article-list {
    margin-top: 1rem;
  }
  .search__notice,
  .empty-state p {
    color: var(--foundation-muted);
  }
  .empty-state {
    padding-block: 1.5rem;
    border-block: 1px solid var(--foundation-rule);
  }
  .empty-state h2 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 500;
  }
  .recovery-links {
    justify-content: flex-start;
  }
</style>
