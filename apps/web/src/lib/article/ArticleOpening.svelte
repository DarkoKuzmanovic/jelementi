<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  import ArticleSeriesPosition from './ArticleSeriesPosition.svelte';
  import type { SeriesProjection } from '../series/series-projection';

  let { article, series }: { article: ArticleDocument; series?: SeriesProjection } = $props();
</script>

<!--
  Article opening — the compact Quiet Column opening hierarchy (Variant A,
  c548b7e): category, title, dek, author, publication date, reading time,
  then tags. The canonical category link uses the shared category slug so
  every article connects to discovery. Rendered through ArticleRenderer.
-->
<header class="article-opening">
  <p class="article-opening__category">
    <a href={`/categories/${categorySlug(article.category)}`}>{article.category}</a>
  </p>
  <h1 class="article-opening__title">{article.title}</h1>
  <p class="article-opening__excerpt">{article.excerpt}</p>
  <p class="article-opening__meta">
    <span>By <strong>{article.author}</strong></span>
    <span aria-hidden="true"> · </span>
    {#if article.publishedAt}
      <time datetime={article.publishedAt}>
        {formatPublishedDate(article.publishedAt)}
      </time>
    {/if}
    {#if article.publishedAt}
      <span aria-hidden="true"> · </span>
    {/if}
    <span>{article.readingTimeMinutes} min read</span>
  </p>
  {#if series}<ArticleSeriesPosition {series} currentSlug={article.slug} />{/if}
  {#if article.tags.length > 0}
    <ul class="article-opening__tags" aria-label="Tags">
      {#each article.tags as tag (tag)}
        <li>{tag}</li>
      {/each}
    </ul>
  {/if}
</header>
