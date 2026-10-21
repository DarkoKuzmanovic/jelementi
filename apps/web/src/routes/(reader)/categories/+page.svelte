<script lang="ts">
  import type { PageData } from './$types';
  import { formatPublishedDate } from '$lib/article/format-date';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head
  ><title>Categories — Jelementi</title><meta
    name="description"
    content="Browse Jelementi categories — every published category ordered by article count."
  /></svelte:head
>
<section class="category-directory" aria-labelledby="categories-heading">
  <header class="page-intro">
    <p class="kicker">Browse the publication</p>
    <h1 id="categories-heading">Categories</h1>
    <p>
      Every thread, ordered by the number of published articles. Each opens on its newest
      illustration.
    </p>
  </header>
  <ol class="category-index" aria-label="Categories">
    {#each data.categories as category (category.slug)}
      <li class="category-entry" class:category-entry--illustrated={category.count >= 3}>
        <a class="category-entry__cover" href={`/categories/${category.slug}`}>
          <img
            src={category.newest.cover.src}
            alt={category.newest.cover.alt}
            width="1600"
            height="900"
            loading="lazy"
          />
        </a>
        <div class="category-entry__content">
          <h2><a href={`/categories/${category.slug}`}>{category.name}</a></h2>
          <p class="category-entry__meta">
            <span>{category.count} {category.count === 1 ? 'story' : 'stories'}</span>
            <span aria-hidden="true"> · </span>
            <span
              >newest <time datetime={category.newest.publishedAt}>
                {formatPublishedDate(category.newest.publishedAt)}
              </time></span
            >
          </p>
          <ol class="category-entry__articles">
            {#each category.newestArticles as entry (entry.kind === 'series' ? `series:${entry.series.slug}` : entry.article.slug)}
              <li>
                {#if entry.kind === 'series'}
                  <a class="category-entry__series" href={`/articles/${entry.href}`}>
                    <img src={entry.cover.src} alt="" width="1600" height="900" loading="lazy" />
                    <span>{entry.title}</span>
                  </a>
                  <span>{entry.readingTimeMinutes} min</span>
                {:else}
                  <a href={`/articles/${entry.article.slug}`}>{entry.article.title}</a>
                  <span>{entry.article.readingTimeMinutes} min</span>
                {/if}
              </li>
            {/each}
          </ol>
          <a class="category-entry__all" href={`/categories/${category.slug}`}
            >All {category.count} in {category.name} →</a
          >
        </div>
      </li>
    {/each}
  </ol>
</section>
