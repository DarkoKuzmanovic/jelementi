<script lang="ts">
  import type { SeriesProjection } from '../series/series-projection';
  let { series, currentSlug }: { series: SeriesProjection; currentSlug: string } = $props();
</script>

<nav class="article-series-position" aria-label={`${series.title} parts`}>
  <ol class="article-series-position__segments">
    {#each series.parts as part (part.slug)}
      <li>
        {#if part.slug === currentSlug}
          <span aria-current="step">{part.part}</span>
        {:else}
          <a href={`/articles/${part.slug}`} aria-label={`Part ${part.part}`}>{part.part}</a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
