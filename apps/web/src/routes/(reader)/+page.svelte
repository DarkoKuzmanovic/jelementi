<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  import SeriesSummary from '$lib/series/SeriesSummary.svelte';
  import { seriesPartTitle } from '$lib/series/series-projection';

  let { data }: { data: PageData } = $props();
  const wideShelves = $derived(data.catalog.shelves.filter((shelf) => shelf.entries.length === 3));
  const compactShelves = $derived(data.catalog.shelves.filter((shelf) => shelf.entries.length < 3));
</script>

<svelte:head
  ><title>Jelementi</title><meta
    name="description"
    content="Curious, careful stories from nearby and far away — the complete published catalog of Jelementi."
  /></svelte:head
>
<section class="home-catalog" aria-labelledby="home-heading">
  <h1 id="home-heading" class="visually-hidden">Jelementi</h1>
  {#if data.catalog.lead}
    <div class="home-lead" data-home-tier="lead">
      <ArticleSummary article={data.catalog.lead} lead audioAvailable={data.hasLeadAudio} />
    </div>
  {/if}
  {#if data.catalog.recent.length > 0}
    <section class="home-recent" aria-labelledby="recent-heading" data-home-tier="recent">
      <div class="home-section-heading">
        <p id="recent-heading">Recently published</p>
        <a href="/search">All articles →</a>
      </div>
      <ol class="home-recent__list">
        {#each data.catalog.recent as article (article.slug)}<li>
            <ArticleSummary {article} />
          </li>{/each}
      </ol>
    </section>
  {/if}
  <div id="series">
    {#if data.series.length > 0}
      <section class="home-series" aria-label="Series" data-home-tier="series">
        {#each data.series as series (series.slug)}
          {@const firstPart = series.parts[0]}
          {#if firstPart}
            <article class="home-series__band">
              <div class="home-series__intro">
                <p class="home-series__kicker">Series · {series.category}</p>
                <h2>{series.title}</h2>
                <p class="home-series__details">
                  {series.parts.length} parts · {series.totalMinutes} min
                </p>
              </div>
              <ol class="home-series__cards" aria-label={`${series.title} parts`}>
                {#each series.parts as part (part.slug)}
                  <li>
                    <a href={`/articles/${part.slug}`}>
                      <img src={part.cover.src} alt="" width="1600" height="900" loading="lazy" />
                      <span class="home-series__card-meta"
                        >Part {part.part} · {part.readingTimeMinutes} min</span
                      >
                      <span class="home-series__card-title">{seriesPartTitle(series, part)}</span>
                    </a>
                  </li>
                {/each}
              </ol>
              <ol
                class="home-series__covers"
                aria-label={`${series.title} part covers`}
                style={`--series-part-count: ${series.parts.length}`}
              >
                {#each series.parts as part (part.slug)}
                  <li>
                    <a
                      href={`/articles/${part.slug}`}
                      aria-label={`Part ${part.part}: ${seriesPartTitle(series, part)}`}
                    >
                      <img src={part.cover.src} alt="" width="1600" height="900" loading="lazy" />
                    </a>
                  </li>
                {/each}
              </ol>
              <ol class="home-series__mobile-list" aria-label={`${series.title} reading order`}>
                {#each series.parts as part (part.slug)}
                  <li>
                    <span class="home-series__part-number">{part.part}</span>
                    <a href={`/articles/${part.slug}`}>{seriesPartTitle(series, part)}</a>
                    <span class="home-series__minutes">{part.readingTimeMinutes} min</span>
                  </li>
                {/each}
              </ol>
              <a class="home-series__action" href={`/articles/${firstPart.slug}`}
                >Start with part 1 →</a
              >
            </article>
          {/if}
        {/each}
      </section>
    {/if}
  </div>
  <aside class="podcast-invitation" aria-labelledby="podcast-heading">
    <div>
      <h2 id="podcast-heading">Prefer to listen?</h2>
      <p>The same stories, told aloud.<br />Add Jelementi to your podcast app.</p>
    </div>
    <a href="/podcast.xml">Get the podcast <span aria-hidden="true">↗</span></a>
  </aside>
  {#if data.catalog.shelves.length > 0}
    <section class="home-more" aria-labelledby="more-heading" data-home-tier="shelves">
      <div class="home-section-heading">
        <h2 id="more-heading">More articles</h2>
        <a href="/search">Search the archive →</a>
      </div>
      {#if wideShelves.length > 0}
        <div class="home-shelves home-shelves--wide">
          {#each wideShelves as shelf (shelf.categorySlug)}
            <section
              class="home-shelf home-shelf--wide"
              aria-labelledby={`home-shelf-${shelf.categorySlug}`}
            >
              <div class="home-shelf__label">
                <h3 id={`home-shelf-${shelf.categorySlug}`}>
                  <a href={`/categories/${shelf.categorySlug}`}>{shelf.category}</a>
                </h3>
                <p>{shelf.total} stories</p>
                <a class="home-shelf__all" href={`/categories/${shelf.categorySlug}`}>
                  <span class="home-shelf__all-wide">All in {shelf.category} →</span>
                  <span class="home-shelf__all-compact">All {shelf.total} →</span>
                </a>
              </div>
              <ol class="home-shelf__entries">
                {#each shelf.entries as entry (entry.kind === 'series' ? `series:${entry.series.slug}` : entry.article.slug)}
                  <li>
                    {#if entry.kind === 'series'}
                      <SeriesSummary {entry} headingLevel={4} />
                    {:else}
                      <ArticleSummary article={entry.article} headingLevel={4} />
                    {/if}
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/if}
      {#if compactShelves.length > 0}
        <div class="home-shelves home-shelves--compact">
          {#each compactShelves as shelf (shelf.categorySlug)}
            <section
              class="home-shelf home-shelf--compact"
              aria-labelledby={`home-shelf-${shelf.categorySlug}`}
            >
              <div class="home-shelf__heading">
                <div>
                  <h3 id={`home-shelf-${shelf.categorySlug}`}>
                    <a href={`/categories/${shelf.categorySlug}`}>{shelf.category}</a>
                  </h3>
                  <p>{shelf.total} stories</p>
                </div>
                <a class="home-shelf__all" href={`/categories/${shelf.categorySlug}`}>
                  <span class="home-shelf__all-wide">All in {shelf.category} →</span>
                  <span class="home-shelf__all-compact">All {shelf.total} →</span>
                </a>
              </div>
              <ol class="home-shelf__entries">
                {#each shelf.entries as entry (entry.kind === 'series' ? `series:${entry.series.slug}` : entry.article.slug)}
                  <li>
                    {#if entry.kind === 'series'}
                      <SeriesSummary {entry} headingLevel={4} />
                    {:else}
                      <ArticleSummary article={entry.article} headingLevel={4} />
                    {/if}
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</section>
