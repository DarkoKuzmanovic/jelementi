<script lang="ts">
  import { seriesPartTitle, type SeriesProjection } from '../series/series-projection';

  let { series, currentSlug }: { series: SeriesProjection; currentSlug: string } = $props();
  const current = $derived(series.parts.find((part) => part.slug === currentSlug));
</script>

{#if current}
  {@const currentIndex = series.parts.findIndex((part) => part.slug === currentSlug)}
  {@const previous = series.parts[currentIndex - 1]}
  {@const next = series.parts[currentIndex + 1]}
  <section class="article-series-position" aria-label={`${series.title} series position`}>
    <div class="article-series-position__heading">
      <a href={`/articles/${series.parts[0]?.slug}`}>{series.title}</a>
      <span>Part {current.part} of {series.parts.length}</span>
    </div>
    <ol class="article-series-position__segments" aria-label={`${series.title} parts`}>
      {#each series.parts as part (part.slug)}
        <li class:article-series-position__segment--current={part.slug === currentSlug}>
          <span aria-hidden="true"></span>
          <span
            class="visually-hidden"
            aria-current={part.slug === currentSlug ? 'step' : undefined}
            >Part {part.part}{part.slug === currentSlug ? ', current' : ''}</span
          >
        </li>
      {/each}
    </ol>
    <nav class="article-series-position__navigation" aria-label="Series parts">
      {#if previous}
        <a class="article-series-position__previous" href={`/articles/${previous.slug}`}>
          <span aria-hidden="true">←</span> Part {previous.part}
          <span>{seriesPartTitle(series, previous)}</span>
        </a>
      {/if}
      {#if next}
        <a class="article-series-position__next" href={`/articles/${next.slug}`}>
          <span>Part {next.part}</span>
          <span>{seriesPartTitle(series, next)}</span>
          <span aria-hidden="true">→</span>
        </a>
      {/if}
    </nav>
  </section>
{/if}
