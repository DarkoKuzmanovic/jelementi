<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  import ArticleSeriesPosition from './ArticleSeriesPosition.svelte';
  import type { SeriesProjection } from '../series/series-projection';
  import Kicker from '../reader/Kicker.svelte';
  import { articleAudioAnchor } from './audio-anchor';
  let { article, series }: { article: ArticleDocument; series?: SeriesProjection } = $props();
</script>

<header class="article-opening">
  <a class="article-opening__category" href={`/categories/${categorySlug(article.category)}`}>
    <Kicker
      category={article.category}
      categorySlug={categorySlug(article.category)}
      extra={`${article.readingTimeMinutes} min read`}
    />
  </a>
  <h1 class="article-opening__title">{article.title}</h1>
  <p class="article-opening__excerpt">{article.excerpt}</p>
  <p class="article-opening__meta">
    <span>By {article.author}</span>
    {#if article.publishedAt}<span aria-hidden="true"> · </span><time datetime={article.publishedAt}
        >{formatPublishedDate(article.publishedAt)}</time
      >{/if}
    <span aria-hidden="true"> · </span><span>Sources: {article.references.length}</span>
  </p>
  {#if article.audio}
    <a class="article-listen" href={`#${articleAudioAnchor}`}>
      <span class="article-listen__play" aria-hidden="true">▶</span>
      <span>Listen to this story</span><span aria-hidden="true"> · </span>
      {#if article.audio.durationSeconds !== undefined}<span class="article-listen__duration"
          >{Math.floor(article.audio.durationSeconds / 60)}:{String(
            article.audio.durationSeconds % 60,
          ).padStart(2, '0')}</span
        >{/if}
    </a>
  {/if}
  {#if series}<ArticleSeriesPosition {series} currentSlug={article.slug} />{/if}
</header>
