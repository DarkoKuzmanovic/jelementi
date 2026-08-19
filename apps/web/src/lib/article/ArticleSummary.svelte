<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';

  let { article }: { article: ArticleIndexEntry } = $props();

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

<!--
  ArticleSummary — the ONE shared semantic hierarchy for Reader discovery:
  title link, excerpt, and a metadata line (category link, publication date,
  reading time). Home, category, and Search compose this same hierarchy with
  surface-specific layout classes; composition differences never change the
  semantic order below.
-->
<article class="article-summary">
  <h2 class="article-summary__title">
    <a href={`/articles/${article.slug}`}>{article.title}</a>
  </h2>
  <p class="article-summary__excerpt">{article.excerpt}</p>
  <p class="article-summary__meta">
    <a class="article-summary__category" href={`/categories/${article.categorySlug}`}>
      {article.category}
    </a>
    <span aria-hidden="true"> · </span>
    <time datetime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
    <span aria-hidden="true"> · </span>
    {article.readingTimeMinutes} min read
  </p>
</article>

<style>
  .article-summary__title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-serif);
    font-size: var(--text-h3);
    line-height: var(--leading-heading);
  }

  .article-summary__title a {
    color: var(--foundation-ink);
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--foundation-ink) 28%, transparent);
    text-underline-offset: 0.18em;
    text-decoration-thickness: 1px;
  }

  .article-summary__title a:hover {
    color: var(--foundation-link);
    text-decoration-color: currentColor;
    text-decoration-thickness: 0.14em;
  }

  .article-summary__excerpt {
    margin: 0 0 var(--space-2);
    color: var(--foundation-muted);
  }

  .article-summary__meta {
    margin: 0;
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }

  .article-summary__category {
    color: var(--foundation-accent);
    font-weight: 650;
  }
</style>
