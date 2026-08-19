<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.category} — Jelementi</title></svelte:head>
<section aria-labelledby="category-heading">
  <h1 id="category-heading">{data.category}</h1>
  <ul class="article-list">
    {#each data.articles as article (article.slug)}
      <li>
        <ArticleSummary {article} />
      </li>
    {/each}
  </ul>
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
