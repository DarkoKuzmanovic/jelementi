<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import type { PageData } from './$types';
  import Card from '$lib/reader/Card.svelte';
  import Kicker from '$lib/reader/Kicker.svelte';
  import { categoryHue } from '$lib/reader/category-hues';
  import { formatPublishedDate } from '$lib/article/format-date';
  import { articleAudioAnchor } from '$lib/article/audio-anchor';
  import { seriesPartTitle, type SeriesProjection } from '$lib/series/series-projection';
  import { coverImage } from '$lib/reader/cover-image';

  let { data }: { data: PageData } = $props();
  const wideShelves = $derived(data.catalog.shelves.filter((shelf) => !shelf.compact));
  const compactShelves = $derived(data.catalog.shelves.filter((shelf) => shelf.compact));
  const series = $derived(data.catalog.series[0]);
  const olderSeries = $derived(data.catalog.series.slice(1));
  const leadSeries = $derived(
    data.catalog.series.find((entry) => entry.slug === data.catalog.lead?.series?.slug),
  );
  function duration(seconds: number | undefined): string {
    return seconds === undefined
      ? ''
      : ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function partCount(count: number): string {
    return (
      [
        'Zero',
        'One',
        'Two',
        'Three',
        'Four',
        'Five',
        'Six',
        'Seven',
        'Eight',
        'Nine',
        'Ten',
        'Eleven',
        'Twelve',
      ][count] ?? String(count)
    );
  }
</script>

<svelte:head>
  <title>Jelementi</title>
  <meta
    name="description"
    content="Curious, careful stories from nearby and far away — the complete published catalog of Jelementi."
  />
</svelte:head>

{#snippet play()}
  <svg width="11" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"
    ><path d="M0 0 10 6 0 12Z" /></svg
  >
{/snippet}
{#snippet meta(article: ArticleIndexEntry)}
  <p class="meta">
    <time datetime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time> · {article.readingTimeMinutes}
    min read
  </p>
{/snippet}
{#snippet seriesLinks(entry: SeriesProjection)}
  <a href={`/series/${entry.slug}.epub`}>EPUB for e-readers</a>
  {#if data.datedSeries.includes(entry.slug)}<a href={`/series/${entry.slug}/dates`}
      >Dates to remember</a
    >{/if}
{/snippet}
{#snippet compactStory(article: ArticleIndexEntry, kicker = true)}
  <article class="home-compact-story" data-home-story={article.slug}>
    <img
      {...coverImage(article.cover.src, '136px')}
      alt={article.cover.alt}
      width="112"
      height="75"
      loading="lazy"
    />
    <div class="home-compact-story__text">
      {#if kicker}<Kicker category={article.category} categorySlug={article.categorySlug} />{/if}
      <svelte:element this={kicker ? 'h3' : 'h4'} class="title">
        <a href={`/articles/${article.slug}`}>{article.title}</a>
      </svelte:element>
      {#if !kicker}{@render meta(article)}{:else}<span class="home-mobile-minutes"
          >{article.readingTimeMinutes} min</span
        >{/if}
    </div>
  </article>
{/snippet}

<section class="home-catalog" aria-labelledby="home-heading">
  <h1 id="home-heading" class="visually-hidden">Jelementi</h1>
  {#if data.catalog.lead}
    {@const lead = data.catalog.lead}
    {@const leadPart = leadSeries?.parts.find((part) => part.slug === lead.slug)}
    <div data-home-tier="lead">
      <article class="home-lead home-width" data-home-story={lead.slug}>
        <img
          {...coverImage(lead.cover.src, '(max-width: 760px) 100vw, 720px')}
          alt={lead.cover.alt}
          width="720"
          height="480"
          fetchpriority="high"
        />
        <div class="home-lead__text">
          <Kicker
            category={lead.category}
            categorySlug={lead.categorySlug}
            extra={leadSeries && leadPart
              ? `${leadSeries.title} · Part ${leadPart.part} of ${leadSeries.parts.length}`
              : 'Lead story'}
          />
          <h2 class="title">
            <a href={`/articles/${lead.slug}`}
              >{leadSeries && leadPart ? seriesPartTitle(leadSeries, leadPart) : lead.title}</a
            >
          </h2>
          <p class="home-lead__deck">{lead.excerpt}</p>
          {@render meta(lead)}
          <div class="home-actions">
            <a class="reader-button" href={`/articles/${lead.slug}`}
              ><span class="home-desktop"
                >{leadPart ? `Read part ${leadPart.part} →` : 'Read the story →'}</span
              ><span class="home-mobile">Read →</span></a
            >
            {#if data.leadAudio}<a
                class="reader-button reader-button--secondary"
                href={`/articles/${lead.slug}#${articleAudioAnchor}`}
                >{@render play()}Listen{duration(data.leadAudio.durationSeconds)}</a
              >{/if}
          </div>
          {#if leadSeries}<a class="home-lead__series" href="#series"
              >All {partCount(leadSeries.parts.length).toLowerCase()} parts ↓</a
            >{/if}
        </div>
      </article>
    </div>
  {/if}
  {#if data.catalog.recent.length}
    <section
      class="home-recent home-width"
      aria-labelledby="recent-heading"
      data-home-tier="recent"
    >
      <div class="home-section-heading">
        <h2 id="recent-heading">Latest stories</h2>
        <div><span>Newest first</span><a href="/search">All stories →</a></div>
      </div>
      <ol class="home-recent__list">
        {#each data.catalog.recent.slice(0, 4) as article (article.slug)}
          <li data-home-story={article.slug}>
            <Card {article} headingLevel={3} /><span class="home-mobile-minutes"
              >{article.readingTimeMinutes} min</span
            >
          </li>
        {/each}
      </ol>
      {#if data.catalog.recent.length > 4}
        <ol class="home-recent__more">
          {#each data.catalog.recent.slice(4) as article (article.slug)}<li>
              {@render compactStory(article)}
            </li>{/each}
        </ol>
      {/if}
    </section>
  {/if}
  <div id="series">
    {#if series}
      {@const first = series.parts[0]}
      <section
        class="home-series home-series__band"
        style={`--hue: ${categoryHue(series.categorySlug)}; --part-count: ${series.parts.length}`}
        aria-label="Series"
      >
        <div class="home-width">
          <div class="home-series__intro">
            <Kicker category={series.category} categorySlug={series.categorySlug} extra="Series" />
            <h2>{series.title}</h2>
            <p class="home-series__details">
              {partCount(series.parts.length)}
              {series.parts.length === 1 ? 'part' : 'parts'} · {series.totalMinutes} minutes&#32;<span
                class="home-desktop"
              >
                · read in order or dip in</span
              >
            </p>
          </div>
          <ol class="home-series__cards" aria-label={`${series.title} parts`}>
            {#each series.parts as part (part.slug)}
              <li>
                <a href={`/articles/${part.slug}`}>
                  <span class="home-series__stop"
                    ><span>{String(part.part).padStart(2, '0')}</span><span
                      class="home-series__line"
                    ></span></span
                  >
                  <img
                    {...coverImage(part.cover.src, '(max-width: 760px) 150px, 230px')}
                    alt={part.cover.alt}
                    width="183"
                    height="122"
                    loading="lazy"
                  />
                  <span
                    class="home-series__card-title"
                    data-part={String(part.part).padStart(2, '0')}
                    >{seriesPartTitle(series, part)}</span
                  >
                  <span class="home-series__minutes">{part.readingTimeMinutes} min</span>
                </a>
              </li>
            {/each}
          </ol>
          {#if first}<div class="home-series__action">
              <a class="reader-button" href={`/articles/${first.slug}`}>Start with part 1 →</a>
              <p class="home-series__links">{@render seriesLinks(series)}</p>
            </div>{/if}
          {#if olderSeries.length}<ol class="home-series__more" aria-label="More series">
              {#each olderSeries as entry (entry.slug)}
                {@const opener = entry.parts[0]}
                <li style={`--hue: ${categoryHue(entry.categorySlug)}`}>
                  {#if opener}<img
                      {...coverImage(opener.cover.src, '(max-width: 760px) 104px, 384px')}
                      alt={opener.cover.alt}
                      width="384"
                      height="256"
                      loading="lazy"
                    />{/if}
                  <div class="home-series__more-text">
                    <Kicker
                      category={entry.category}
                      categorySlug={entry.categorySlug}
                      extra="Series"
                    />
                    <h3>
                      {#if opener}<a href={`/articles/${opener.slug}`}>{entry.title}</a>{/if}
                    </h3>
                    <p class="home-series__details">
                      {partCount(entry.parts.length)} parts · {entry.totalMinutes} minutes
                    </p>
                    <ol class="home-series__part-list" aria-label={`${entry.title} parts`}>
                      {#each entry.parts as part (part.slug)}
                        <li>
                          <a href={`/articles/${part.slug}`}
                            ><span>{String(part.part).padStart(2, '0')}</span>
                            {seriesPartTitle(entry, part)}</a
                          >
                        </li>
                      {/each}
                    </ol>
                    <p class="home-series__links">
                      {#if opener}<a
                          class="reader-button reader-button--secondary"
                          href={`/articles/${opener.slug}`}>Start with part 1 →</a
                        >{/if}{@render seriesLinks(entry)}
                    </p>
                  </div>
                </li>
              {/each}
            </ol>{/if}
        </div>
      </section>
    {/if}
  </div>
  <aside class="podcast-invitation" aria-labelledby="podcast-heading">
    <div class="home-width home-listen">
      <div class="home-listen__copy">
        <h2 id="podcast-heading">Prefer to listen?</h2>
        <p>
          <span class="home-desktop"
            >Listen to narrated stories. Subscribe once and new episodes arrive in your podcast app.</span
          ><span class="home-mobile"
            >Listen to narrated stories. Subscribe once in your podcast app.</span
          >
        </p>
        <div class="home-actions">
          <a class="reader-button" href="/podcast.xml">Get the podcast →</a>
          <a class="reader-button reader-button--secondary home-podcast-rss" href="/podcast.xml"
            >Podcast RSS</a
          >
        </div>
      </div>
      {#if data.narration}
        <a class="home-narration" href={`/articles/${data.narration.slug}#${articleAudioAnchor}`}>
          <span class="home-narration__play">{@render play()}</span>
          <span class="home-narration__text"
            ><span class="home-narration__label"
              >Latest narration{duration(data.narration.durationSeconds)}</span
            ><span class="home-narration__title">{data.narration.title}</span></span
          >
        </a>
      {/if}
    </div>
  </aside>
  {#if data.catalog.shelves.length}
    <section class="home-more home-width" aria-labelledby="more-heading" data-home-tier="shelves">
      <div class="home-section-heading">
        <h2 id="more-heading">Browse by section</h2>
        <div>
          <span
            >{data.storyCount} stories in {data.categoryCount === 5 ? 'five' : data.categoryCount} section{data.categoryCount ===
            1
              ? ''
              : 's'}</span
          ><a href="/search">Search the archive →</a>
        </div>
      </div>
      {#each wideShelves as shelf (shelf.categorySlug)}
        {@render sectionShelf(shelf)}
      {/each}
      {#if compactShelves.length}<div class="home-shelves--compact">
          {#each compactShelves as shelf (shelf.categorySlug)}{@render sectionShelf(shelf)}{/each}
        </div>{/if}
    </section>
  {/if}
</section>

{#snippet sectionShelf(shelf: PageData['catalog']['shelves'][number])}
  <section
    class="home-shelf"
    class:home-shelf--compact={shelf.compact}
    class:home-shelf--wide={!shelf.compact}
    style={`--hue: ${categoryHue(shelf.categorySlug)}`}
    aria-labelledby={`home-shelf-${shelf.categorySlug}`}
  >
    <div class="home-shelf__label">
      <div>
        <h3 id={`home-shelf-${shelf.categorySlug}`}>
          <a href={`/categories/${shelf.categorySlug}`}>{shelf.category}</a>
        </h3>
        <p>{shelf.total} stories</p>
      </div>
      <a class="home-shelf__all" href={`/categories/${shelf.categorySlug}`}
        >All {shelf.category} →</a
      >
      <a
        class="home-shelf__mobile-cover"
        href={`/categories/${shelf.categorySlug}`}
        aria-label={`Browse ${shelf.category}`}
        ><img
          {...coverImage((shelf.entries[0] ?? shelf.newest).cover.src, '72px')}
          alt={(shelf.entries[0] ?? shelf.newest).cover.alt}
          width="72"
          height="48"
          loading="lazy"
        /></a
      >
    </div>
    <ol class="home-shelf__entries">
      {#each shelf.entries as article (article.slug)}
        <li>
          {#if shelf.compact}{@render compactStory(article, false)}{:else}<div
              data-home-story={article.slug}
            >
              <Card {article} showKicker={false} headingLevel={4} />
            </div>{/if}
        </li>
      {/each}
    </ol>
  </section>
{/snippet}
