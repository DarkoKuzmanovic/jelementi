<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ] as const;

  function formatPublishedDate(value: string): string {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    const month = MONTHS[date.getUTCMonth()];
    if (month === undefined) return value;
    return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
  }
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
    <p>Every thread, ordered by the number of published articles.</p>
  </header>
  <ol class="category-index divided-list" aria-label="Categories">
    {#each data.categories as category (category.slug)}
      <li class="category-entry">
        <div>
          <h2><a href={`/categories/${category.slug}`}>{category.name}</a></h2>
          <span class="category-count">
            {category.count}
            {category.count === 1 ? 'article' : 'articles'}
          </span>
        </div>
        <div class="category-newest">
          <span class="category-newest__label">Newest article</span>
          <a href={`/articles/${category.newest.slug}`}>{category.newest.title}</a>
          <time datetime={category.newest.publishedAt}>
            {formatPublishedDate(category.newest.publishedAt)}
          </time>
        </div>
      </li>
    {/each}
  </ol>
</section>
