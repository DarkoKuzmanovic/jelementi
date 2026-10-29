<script lang="ts">
  import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
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

{#snippet seriesTools(slug: string)}
  <!-- Inline margin: a new rule would count against the frozen reader CSS budget. -->
  <p style="margin-top: 1.25rem">
    <a href={`/series/${slug}.epub`} download>Download the series as an e-book</a>
  </p>
  {#if studyDates}<p><a href={`/series/${slug}/dates`}>Dates to remember: study cards</a></p>{/if}
{/snippet}

<nav class="article-continuation" aria-label="Continue reading">
  {#if series && !nextSeriesPart}
    <p class="article-series-continuation__kicker">
      <span>You've finished the series</span>
      <span aria-hidden="true"> · </span>
      <span>{series.title}</span>
    </p>
    {@render seriesTools(series.slug)}
  {/if}
  {#if series && nextSeriesPart}
    <p class="article-series-continuation__kicker">
      <span>Continue the series</span>
      <span aria-hidden="true"> · </span>
      <span>{series.title}</span>
    </p>
    <div class="article-series-continuation">
      <article class="article-series-continuation__story">
        <img
          src={nextSeriesPart.cover.src}
          alt={nextSeriesPart.cover.alt}
          width="1600"
          height="900"
          loading="lazy"
        />
        <div>
          <p class="article-continuation__meta">
            Part {nextSeriesPart.part} of {series.parts.length} · {nextSeriesPart.readingTimeMinutes}
            min read
          </p>
          <h2>
            <a class="article-continuation__next" href={`/articles/${nextSeriesPart.slug}`}
              >{seriesPartTitle(series, nextSeriesPart)}</a
            >
          </h2>
          <p class="article-series-continuation__excerpt">{nextSeriesPart.excerpt}</p>
          <a
            class="article-series-continuation__action reader-button"
            href={`/articles/${nextSeriesPart.slug}`}>Continue to part {nextSeriesPart.part} →</a
          >
        </div>
      </article>
      <aside
        class="article-series-continuation__list"
        aria-labelledby="article-series-whole-heading"
      >
        <h2 id="article-series-whole-heading">The whole series</h2>
        <ol>
          {#each series.parts as part (part.slug)}
            <li>
              <span class="article-series-continuation__number">{part.part}</span>
              <div>
                {#if part.slug === article.slug}
                  <span aria-current="page">{seriesPartTitle(series, part)}</span>
                  <span class="article-series-continuation__status">You are here</span>
                {:else}
                  <a href={`/articles/${part.slug}`}>{seriesPartTitle(series, part)}</a>
                  <span class="article-series-continuation__status">
                    {part.slug === nextSeriesPart.slug
                      ? 'Up next'
                      : `${part.readingTimeMinutes} min`}
                  </span>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
        {@render seriesTools(series.slug)}
      </aside>
    </div>
    <a class="article-continuation__category" href={`/categories/${categorySlug(article.category)}`}
      >More in {article.category} →</a
    >
  {:else}
    <section class="article-keep-reading">
      <div class="article-keep-reading__heading">
        <h2>Keep reading in {article.category}</h2>
        <a href={`/categories/${categorySlug(article.category)}`}>All {article.category} →</a>
      </div>
      <div class="article-keep-reading__cards">
        {#each stories as story (story.slug)}<Card
            article={story}
            showDeck
            headingLevel={3}
          />{/each}
      </div>
    </section>
  {/if}
</nav>
