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

<svelte:head><title>Search — Jelementi</title></svelte:head>
<section
  class="search"
  aria-labelledby="search-heading"
  data-search-enhanced={enhanced ? 'true' : undefined}
>
  <header class="page-intro search__intro">
    <p class="kicker">Find a story</p>
    <h1 id="search-heading">Search</h1>
    <p>Browse every published article, or filter the catalog.</p>
  </header>

  <form class="search-form" role="search" action="/search" method="get" onsubmit={submitSearch}>
    <label for="article-search">Search published articles</label>
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
  .search-form {
    max-width: 47rem;
    margin-bottom: var(--space-8);
  }

  .search-form label {
    display: block;
    margin-bottom: var(--space-1);
    font-weight: 700;
  }

  .search-form__row {
    display: flex;
    gap: var(--space-2);
  }

  .search-form input,
  button {
    min-height: 44px;
    border: 1px solid var(--foundation-control-border);
    border-radius: var(--radius-control);
    background: var(--foundation-control-surface);
    color: var(--foundation-control-text);
    font: inherit;
  }

  .search-form input {
    min-width: 0;
    flex: 1;
    padding: var(--space-2) var(--space-3);
  }

  button {
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    font-weight: 700;
  }

  button:hover {
    border-color: var(--foundation-accent);
  }

  .search-form button,
  .empty-state button {
    border-color: var(--foundation-accent);
    background: var(--foundation-accent);
    color: var(--foundation-paper);
  }

  .search__notice {
    color: var(--foundation-muted);
  }

  .search-results__heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    flex-wrap: wrap;
  }

  .search-results__heading p {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-h3);
    font-weight: 700;
  }

  .search-results__heading button {
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-compact);
  }

  .article-list {
    margin-top: var(--space-3);
  }

  .article-list li {
    padding: var(--space-3) 0;
  }

  .empty-state {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6) 0;
    border-block: 1px solid var(--foundation-rule);
  }

  .empty-state h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-h2);
    line-height: var(--leading-heading);
  }

  .recovery-links {
    display: flex;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    flex-wrap: wrap;
  }

  @media (max-width: 430px) {
    .search-form__row {
      align-items: stretch;
      flex-direction: column;
    }

    .search-form__row button {
      width: 100%;
    }
  }
  .search__intro {
    max-width: 47rem;
    margin-bottom: var(--space-8);
  }

  .search__intro h1 {
    font-size: var(--text-h1);
  }

  .search__intro > p:last-child {
    max-width: 42rem;
    font-size: 1.125rem;
  }
</style>
