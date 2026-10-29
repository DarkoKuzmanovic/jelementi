<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  import ArticleSeriesPosition from './ArticleSeriesPosition.svelte';
  import { seriesPartTitle, type SeriesProjection } from '../series/series-projection';
  import Kicker from '../reader/Kicker.svelte';
  import { articleAudioAnchor } from './audio-anchor';
  let { article, series }: { article: ArticleDocument; series?: SeriesProjection } = $props();
  const currentIndex = $derived(
    series?.parts.findIndex((part) => part.slug === article.slug) ?? -1,
  );
  const current = $derived(series?.parts[currentIndex]);
  const previous = $derived(series?.parts[currentIndex - 1]);
  const next = $derived(series && currentIndex >= 0 ? series.parts[currentIndex + 1] : undefined);
</script>

<header class="article-opening" class:article-opening--series={!!current}>
  {#if series && current}<ArticleSeriesPosition {series} currentSlug={article.slug} />{/if}
  <a class="article-opening__category" href={`/categories/${categorySlug(article.category)}`}>
    <Kicker
      category={article.category}
      categorySlug={categorySlug(article.category)}
      extra={series && current
        ? `${series.title} · Part ${current.part} of ${series.parts.length}`
        : `${article.readingTimeMinutes} min read`}
    />
  </a>
  <h1 class="article-opening__title">
    {series && current
      ? seriesPartTitle(series, { ...current, title: article.title })
      : article.title}
  </h1>
  <p class="article-opening__excerpt">{article.excerpt}</p>
  <p class="article-opening__meta">
    <span>By {article.author}</span>
    {#if article.publishedAt}<span aria-hidden="true"> · </span><time datetime={article.publishedAt}
        >{formatPublishedDate(article.publishedAt)}</time
      >{/if}
    {#if current}<span aria-hidden="true"> · </span><span
        >{article.readingTimeMinutes} min read</span
      >{/if}
    <span aria-hidden="true"> · </span><span>Sources: {article.references.length}</span>
  </p>
  {#if article.audio}
    <a class="article-listen" href={`#${articleAudioAnchor}`}>
      <span class="article-listen__play" aria-hidden="true">▶</span>
      <span>{current ? `Listen to part ${current.part}` : 'Listen to this story'}</span><span
        aria-hidden="true"
      >
        ·
      </span>
      {#if article.audio.durationSeconds !== undefined}<span class="article-listen__duration"
          >{Math.floor(article.audio.durationSeconds / 60)}:{String(
            article.audio.durationSeconds % 60,
          ).padStart(2, '0')}</span
        >{/if}
    </a>
  {/if}
  {#if series && current}
    <nav class="article-series-position__navigation" aria-label="Series parts">
      {#if previous}
        <a class="article-series-position__previous" href={`/articles/${previous.slug}`}>
          <span>← Part {previous.part}</span><strong>{seriesPartTitle(series, previous)}</strong>
        </a>
      {/if}
      {#if next}
        <a class="article-series-position__next" href={`/articles/${next.slug}`}>
          <span>Part {next.part} →</span><strong>{seriesPartTitle(series, next)}</strong>
        </a>
      {/if}
    </nav>
  {/if}
</header>
