<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.category} — Jelementi</title></svelte:head>
<section class="category-listing" aria-labelledby="category-heading">
  <header class="page-intro">
    <p class="kicker"><a href="/categories">Categories</a></p>
    <h1 id="category-heading">{data.category}</h1>
    <p>
      {data.articles.length}
      {data.articles.length === 1 ? 'article' : 'articles'}, newest first.
    </p>
  </header>
  <ul class="category-articles divided-list">
    {#each data.articles as article (article.slug)}
      <li>
        <ArticleSummary {article} />
      </li>
    {/each}
  </ul>
  <p class="return-link"><a href="/categories">← All categories</a></p>
</section>

<style>
  .category-listing {
    display: grid;
    gap: var(--space-8);
  }

  .return-link {
    margin: 0;
  }
</style>
