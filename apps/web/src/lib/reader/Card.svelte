<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from '../article/format-date';
  import Kicker from './Kicker.svelte';

  let {
    article,
    showDeck = false,
    showKicker = true,
    headingLevel = 2,
    kickerExtra,
  }: {
    article: ArticleIndexEntry;
    kickerExtra?: string;
    showDeck?: boolean;
    showKicker?: boolean;
    headingLevel?: 2 | 3 | 4;
  } = $props();
</script>

<article class="card">
  <img src={article.cover.src} alt={article.cover.alt} width="600" height="400" loading="lazy" />
  {#if showKicker}<Kicker
      category={article.category}
      categorySlug={article.categorySlug}
      extra={kickerExtra}
    />{/if}
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
