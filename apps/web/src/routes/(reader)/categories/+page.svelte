<script lang="ts">
  import type { PageData } from './$types';
  import { formatPublishedDate } from '$lib/article/format-date';
  import { categoryHue } from '$lib/reader/category-hues';
  let { data }: { data: PageData } = $props();
  const count = $derived(data.categories.reduce((total, category) => total + category.count, 0));
</script>

<svelte:head>
  <title>Sections — Jelementi</title>
  <meta
    name="description"
    content="Browse Jelementi sections — every published category ordered by story count."
  />
</svelte:head>
<section class="sections" aria-labelledby="categories-heading">
  <header class="sec-intro">
    <p class="kicker">Browse</p>
    <h1 id="categories-heading">Sections</h1>
    <p>
      {count} stories in {data.categories.length === 5 ? 'five' : data.categories.length} sections<span
        class="desk-only">, ordered by size</span
      >. <span class="desk-only">Each opens on its newest illustration.</span>
    </p>
  </header>
  <nav class="sec-jumps" aria-label="Jump to section">
    {#each data.categories as category (category.slug)}
      <a href={`#${category.slug}`} style:--hue={categoryHue(category.slug)}>
        <span class="jump-name">{category.name}</span>
        <span>{category.count} {category.count === 1 ? 'story' : 'stories'}</span>
      </a>
    {/each}
  </nav>
  <ol class="sec-index">
    {#each data.categories as category, rank (category.slug)}
      <li
        id={category.slug}
        class="sec-block"
        class:sec-wide={rank < 3}
        style:--hue={categoryHue(category.slug)}
      >
        <div class="sec-heading">
          <h2><a href={`/categories/${category.slug}`}>{category.name}</a></h2>
          <p class="sec-meta">
            {category.count}
            {category.count === 1 ? 'story' : 'stories'}<span class="desk-only">
              · newest <time datetime={category.newest.publishedAt}
                >{formatPublishedDate(category.newest.publishedAt)}</time
              ></span
            >
          </p>
        </div>
        <a class="sec-cover" href={`/categories/${category.slug}`}>
          <img
            src={category.newest.cover.src}
            alt={category.newest.cover.alt}
            width="576"
            height="384"
            loading="lazy"
          />
        </a>
        <ol class="sec-titles">
          {#each category.newestArticles.slice(0, rank < 3 ? 4 : undefined) as article (article.slug)}
            <li>
              <a href={`/articles/${article.slug}`}>{article.title}</a><span
                >{article.readingTimeMinutes} min</span
              >
            </li>
          {/each}
        </ol>
        <a
          class="sec-link reader-button reader-button--secondary"
          href={`/categories/${category.slug}`}
          >All {category.count} {category.name} {category.count === 1 ? 'story' : 'stories'} →</a
        >
      </li>
    {/each}
  </ol>
</section>
