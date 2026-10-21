<script lang="ts">
  import { formatPublishedDate } from '../article/format-date';
  import type { SeriesCatalogEntry } from './series-projection';

  let {
    entry,
    headingLevel = 2,
  }: {
    entry: SeriesCatalogEntry;
    headingLevel?: 2 | 3 | 4;
  } = $props();
  const titleTag = $derived(`h${headingLevel}`);
</script>

<article class="article-summary">
  <img
    class="article-summary__cover"
    src={entry.cover.src}
    alt={entry.cover.alt}
    width="1600"
    height="900"
    loading="lazy"
  />
  <div class="article-summary__text">
    <p class="article-summary__meta">
      <a class="article-summary__category" href={`/categories/${entry.series.categorySlug}`}
        >{entry.series.category}</a
      >
      &#32;<span aria-hidden="true">·</span>&#32;{entry.readingTimeMinutes} min read
    </p>
    <svelte:element this={titleTag} class="article-summary__title">
      <a href={`/articles/${entry.href}`}>{entry.title}</a>
    </svelte:element>
    <p class="article-summary__excerpt">A series in {entry.series.parts.length} parts.</p>
    <time class="article-summary__date visually-hidden" datetime={entry.publishedAt}
      >{formatPublishedDate(entry.publishedAt)}</time
    >
  </div>
</article>
