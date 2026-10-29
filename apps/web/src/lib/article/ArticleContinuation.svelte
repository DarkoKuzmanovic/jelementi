<script lang="ts">
  import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { categoryHue } from '../reader/category-hues';
  import Kicker from '../reader/Kicker.svelte';
  import Card from '../reader/Card.svelte';
  import { seriesPartTitle, type SeriesProjection } from '../series/series-projection';
  let {
    article,
    nextOlder,
    stories = nextOlder ? [nextOlder] : [],
    series,
    studyDates = false,
  }: {
    article: ArticleDocument;
    nextOlder: ArticleIndexEntry | null;
    stories?: ArticleIndexEntry[];
    series?: SeriesProjection;
    studyDates?: boolean;
  } = $props();
  const seriesPartIndex = $derived(
    series?.parts.findIndex(({ slug }) => slug === article.slug) ?? -1,
  );
  const nextSeriesPart = $derived(
    series && seriesPartIndex >= 0 ? series.parts[seriesPartIndex + 1] : undefined,
  );
</script>

<nav
  class="article-continuation"
  aria-label="Continue reading"
  style:--article-hue={categoryHue(categorySlug(article.category))}
>
  {#if series}
    <section class="article-series-continuation" aria-labelledby="reader:series-continue">
      <div class="article-series-continuation__heading">
        <div>
          <div class="article-series-continuation__kicker">
            <Kicker
              category={series.category}
              categorySlug={series.categorySlug}
              extra="Continue the series"
            />
          </div>
          <h2 id="reader:series-continue">
            {nextSeriesPart
              ? `Next: Part ${nextSeriesPart.part}, ${seriesPartTitle(series, nextSeriesPart)}`
              : `You've finished ${series.title}`}
          </h2>
        </div>
        {#if nextSeriesPart}
          <a class="reader-button" href={`/articles/${nextSeriesPart.slug}`}
            >Read part {nextSeriesPart.part} →</a
          >
        {:else}
          <a class="reader-button" href={`/articles/${series.parts[0]?.slug}`}>Back to part 1</a>
        {/if}
      </div>
      <ol class="article-series-continuation__list" style:--part-count={series.parts.length}>
        {#each series.parts as part (part.slug)}
          <li class="article-series-continuation__part">
            <a
              href={`/articles/${part.slug}`}
              aria-current={part.slug === article.slug ? 'page' : undefined}
            >
              <img
                src={part.cover.src}
                alt={part.cover.alt}
                width="180"
                height="120"
                loading="lazy"
              />
              <span class="article-series-continuation__meta">
                <span class="article-series-continuation__number"
                  >{String(part.part).padStart(2, '0')}</span
                >
                <span>{part.readingTimeMinutes} min</span>
                {#if part.slug === article.slug}<strong>You are here</strong>{/if}
              </span>
              <span class="article-series-continuation__title">{seriesPartTitle(series, part)}</span
              >
            </a>
          </li>
        {/each}
      </ol>
      <div class="article-series-continuation__tools">
        <a
          class="reader-button reader-button--secondary"
          href={`/series/${series.slug}.epub`}
          download>Download the series as an e-book</a
        >
        {#if studyDates}<a
            class="reader-button reader-button--secondary"
            href={`/series/${series.slug}/dates`}>Dates to remember: study cards</a
          >{/if}
      </div>
    </section>
  {/if}
  <section class="article-keep-reading">
    <div class="article-keep-reading__heading">
      <h2>Keep reading in {article.category}</h2>
      <a href={`/categories/${categorySlug(article.category)}`}>All {article.category} →</a>
    </div>
    <div class="article-keep-reading__cards">
      {#each stories as story (story.slug)}<Card article={story} showDeck headingLevel={3} />{/each}
    </div>
  </section>
</nav>
