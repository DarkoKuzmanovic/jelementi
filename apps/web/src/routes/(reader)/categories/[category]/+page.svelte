<script lang="ts">
  import type { PageData } from './$types';
  import ListItem from '$lib/reader/ListItem.svelte';
  import Kicker from '$lib/reader/Kicker.svelte';
  import { categoryHue } from '$lib/reader/category-hues';
  import { formatPublishedDate } from '$lib/article/format-date';
  let { data }: { data: PageData } = $props();
  const lead = $derived(data.articles[0]!);
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
    <img src={lead.cover.src} alt={lead.cover.alt} width="680" height="420" fetchpriority="high" />
    <div>
      <p class="kicker desk-only">Newest in {data.category}</p>
      <h2><a href={`/articles/${lead.slug}`}>{lead.title}</a></h2>
      <p class="sec-deck desk-only">{lead.excerpt}</p>
      <p class="meta">
        <time datetime={lead.publishedAt}>{formatPublishedDate(lead.publishedAt)}</time> · {lead.readingTimeMinutes}
        min read
      </p>
    </div>
  </article>
  {#if data.articles.length > 1}
    <ul class="sec-cards">
      {#each data.articles.slice(1) as article (article.slug)}
        <li data-section-story={article.slug}><ListItem {article} gridDesktop /></li>
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
