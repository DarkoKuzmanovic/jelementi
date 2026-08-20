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

<style>
  .category-directory {
    display: grid;
    gap: var(--space-8);
  }

  .category-count,
  .category-newest__label {
    font-family: var(--font-mono);
  }

  .category-entry {
    display: grid;
    grid-template-columns: minmax(12rem, 0.8fr) minmax(0, 1.6fr);
    gap: var(--space-4) var(--space-12);
  }

  .category-entry h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-h2);
    line-height: var(--leading-heading);
  }

  .category-entry a {
    color: var(--foundation-ink);
    text-decoration-color: var(--foundation-rule);
    text-underline-offset: 0.18em;
  }

  .category-entry a:hover {
    color: var(--foundation-link);
    text-decoration-color: currentColor;
  }

  .category-count {
    color: var(--foundation-muted);
    font-size: var(--text-compact);
  }

  .category-newest {
    align-self: center;
    min-width: 0;
  }

  .category-newest__label {
    display: block;
    color: var(--foundation-accent);
    font-size: var(--text-compact);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .category-newest > a {
    overflow-wrap: anywhere;
    font-family: var(--font-serif);
    font-size: var(--text-h3);
  }

  .category-newest time {
    display: block;
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }

  @media (max-width: 40rem) {
    .category-entry {
      grid-template-columns: 1fr;
    }
  }
</style>
