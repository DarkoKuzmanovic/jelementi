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
  <ul class="category-articles">
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

  .page-intro {
    padding-bottom: var(--space-6);
    border-bottom: 3px double var(--foundation-rule);
  }

  .page-intro h1 {
    margin: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-serif);
    font-size: clamp(2.5rem, 7vw, 5.4rem);
    line-height: var(--leading-heading);
    letter-spacing: -0.035em;
  }

  .page-intro > p:last-child {
    margin: var(--space-3) 0 0;
    color: var(--foundation-muted);
    font-family: var(--font-serif);
    font-size: clamp(1.08rem, 2.2vw, 1.35rem);
  }

  .kicker {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-compact);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .kicker a {
    color: var(--foundation-accent);
  }

  .category-articles {
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--foundation-rule);
    list-style: none;
  }

  .category-articles li {
    padding: var(--space-6) 0;
    border-bottom: 1px solid var(--foundation-rule);
  }

  .return-link {
    margin: 0;
  }
</style>
