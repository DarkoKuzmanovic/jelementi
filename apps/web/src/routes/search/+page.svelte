<script lang="ts">
  import type { PageData } from './$types';
  import { filterArticles } from '$lib/generated-content';
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
        <li><a href={`/articles/${article.slug}`}>{article.title}</a> — {article.excerpt}</li>
      {/each}
    </ul>
  {/if}
</section>
