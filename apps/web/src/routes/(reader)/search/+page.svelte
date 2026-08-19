<script lang="ts">
  import type { PageData } from './$types';
  import { filterArticles } from '$lib/generated-content';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  let { data }: { data: PageData } = $props();
  let query = $state('');
  const results = $derived(filterArticles(data.index, query));
</script>

<svelte:head><title>Search — Jelementi</title></svelte:head>
<section aria-labelledby="search-heading">
  <h1 id="search-heading">Search</h1>
  <label for="article-search">Search published articles</label>
  <input id="article-search" name="query" type="search" bind:value={query} />
  {#if results.length === 0}
    <p role="status">No articles match your search.</p>
  {:else}
    <ul class="article-list">
      {#each results as article (article.slug)}
        <li>
          <ArticleSummary {article} />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .article-list {
    list-style: none;
    padding: 0;
  }

  .article-list li {
    padding: var(--space-4) 0;
    border-top: 1px solid var(--foundation-rule);
  }
</style>
