<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from '../article/format-date';
  import Kicker from './Kicker.svelte';

  let {
    article,
    showDeck = false,
    showKicker = true,
    headingLevel = 2,
  }: {
    article: ArticleIndexEntry;
    showDeck?: boolean;
    showKicker?: boolean;
    headingLevel?: 2 | 3 | 4;
  } = $props();
</script>

<article class="card">
  <img src={article.cover.src} alt={article.cover.alt} width="600" height="400" loading="lazy" />
  {#if showKicker}<Kicker category={article.category} categorySlug={article.categorySlug} />{/if}
  <svelte:element this={`h${headingLevel}`} class="title">
    <a href={`/articles/${article.slug}`}>{article.title}</a>
  </svelte:element>
  {#if showDeck}<p class="deck">{article.excerpt}</p>{/if}
  <p class="meta">
    <time datetime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
    <span aria-hidden="true"> · </span>
    {article.readingTimeMinutes} min read
  </p>
</article>

<style>
  .card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 10px;
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    margin-bottom: 2px;
  }
  .title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    line-height: 26px;
    letter-spacing: -0.01em;
  }
  a {
    color: var(--foundation-ink);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  a:focus-visible {
    outline: 2px solid var(--foundation-accent);
    outline-offset: 2px;
  }
  .deck {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: var(--foundation-muted);
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 24px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
  .meta {
    margin: 0;
    color: var(--foundation-muted);
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.4;
  }
</style>
