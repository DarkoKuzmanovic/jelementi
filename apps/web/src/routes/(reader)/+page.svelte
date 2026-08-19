<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Jelementi</title></svelte:head>
<section class="home" aria-labelledby="home-heading">
  <h1 id="home-heading">Jelementi</h1>
  <p class="lede">A small English-language beta reader for curious, careful stories.</p>
  <ul class="article-list">
    {#each data.index as article (article.slug)}
      <li>
        <ArticleSummary {article} />
      </li>
    {/each}
  </ul>
</section>

<style>
  .home h1 {
    font-family: var(--font-serif);
    font-size: var(--text-h1);
    line-height: var(--leading-heading);
    margin-bottom: var(--space-2);
  }

  .lede {
    color: var(--foundation-muted);
    margin-top: 0;
  }

  .article-list {
    list-style: none;
    padding: 0;
  }

  .article-list li {
    padding: var(--space-4) 0;
    border-top: 1px solid var(--foundation-rule);
  }
</style>
