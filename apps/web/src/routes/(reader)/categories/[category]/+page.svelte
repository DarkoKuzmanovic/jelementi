<script lang="ts">
  import { coverImage } from '$lib/reader/cover-image';
  import type { PageData } from './$types';
  import ListItem from '$lib/reader/ListItem.svelte';
  import Kicker from '$lib/reader/Kicker.svelte';
  import { categoryHue } from '$lib/reader/category-hues';
  import { formatPublishedDate } from '$lib/article/format-date';
  let { data }: { data: PageData } = $props();
  const leadItem = $derived(data.items[0]!);
  const lead = $derived(leadItem.article);
</script>

<svelte:head>
  <title>{data.category} — Jelementi</title>
  <meta
    name="description"
    content="Browse the {data.category} section — {data.articles.length} stories, newest first."
  />
</svelte:head>
<section
  class="sec-page"
  aria-labelledby="category-heading"
  style:--hue={categoryHue(lead.categorySlug)}
>
  <header class="sec-intro">
    <p class="kicker">
      <Kicker category={data.category} categorySlug={lead.categorySlug} extra="Section" />
    </p>
    <h1 id="category-heading">{data.category}</h1>
    <p>{data.articles.length} {data.articles.length === 1 ? 'story' : 'stories'}, newest first.</p>
  </header>
  <article class="sec-lead" data-section-story={lead.slug}>
    <img
      {...coverImage(lead.cover.src, '(max-width: 760px) 100vw, 680px')}
      alt={lead.cover.alt}
      width="680"
      height="420"
      fetchpriority="high"
    />
    <div>
      <p class="kicker desk-only">Newest in {data.category}{leadItem.series ? ' · Series' : ''}</p>
      <h2><a href={`/articles/${lead.slug}`}>{leadItem.series?.title ?? lead.title}</a></h2>
      {#if leadItem.series}
        <p class="meta">{leadItem.series.parts.length} parts · {leadItem.series.minutes} minutes</p>
        <ol class="sec-parts">
          {#each leadItem.series.parts as part (part.slug)}
            <li>
              <a href={`/articles/${part.slug}`}
                ><span>{String(part.part).padStart(2, '0')}</span> {part.title}</a
              >
            </li>
          {/each}
        </ol>
      {:else}
        <p class="sec-deck desk-only">{lead.excerpt}</p>
        <p class="meta">
          <time datetime={lead.publishedAt}>{formatPublishedDate(lead.publishedAt)}</time> · {lead.readingTimeMinutes}
          min read
        </p>
      {/if}
    </div>
  </article>
  {#if data.items.length > 1}
    <ul class="sec-cards">
      {#each data.items.slice(1) as { article, series } (article.slug)}
        <li data-section-story={article.slug}>
          {#if series}
            {#snippet seriesTitle()}{series.title}{/snippet}
            {#snippet seriesLine()}<p class="sec-series-line">
                Series · {series.parts.length} parts · {series.minutes} min
              </p>{/snippet}
            <ListItem
              {article}
              gridDesktop
              dateOnly
              titleContent={seriesTitle}
              afterDeck={seriesLine}
              kickerExtra={`Series · ${series.parts.length} parts`}
            />
          {:else}
            <ListItem {article} gridDesktop />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <nav class="sec-nav" aria-label="Other sections">
    <h2>Other sections</h2>
    {#each data.otherCategories as category (category.slug)}
      <a href={`/categories/${category.slug}`} style:--hue={categoryHue(category.slug)}
        ><span class="hue-dot" aria-hidden="true"></span>{category.name}
        <span>{category.count}</span></a
      >
    {/each}
  </nav>
</section>
