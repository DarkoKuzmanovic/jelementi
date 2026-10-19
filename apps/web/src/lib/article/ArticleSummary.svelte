<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  let { article, lead = false }: { article: ArticleIndexEntry; lead?: boolean } = $props();
</script>

<article class="article-summary" class:article-summary--lead={lead}>
  <img
    class="article-summary__cover"
    src={article.cover.src}
    alt={article.cover.alt}
    width="1600"
    height="900"
    loading={lead ? 'eager' : 'lazy'}
    fetchpriority={lead ? 'high' : undefined}
  />
  <div class="article-summary__text">
    {#if lead}<p class="article-summary__eyebrow">Latest article</p>{/if}
    <h2 class="article-summary__title">
      <a href={`/articles/${article.slug}`}>{article.title}</a>
    </h2>
    <p class="article-summary__excerpt">
      {lead ? article.excerpt.replace(/\[\d+\]/g, '') : article.excerpt}
    </p>
    <p class="article-summary__meta">
      <a class="article-summary__category" href={`/categories/${article.categorySlug}`}
        >{article.category}</a
      >
      <span aria-hidden="true"> · </span>
      <time datetime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
      <span aria-hidden="true"> · </span>
      {article.readingTimeMinutes} min read
    </p>
    {#if lead}
      <p class="article-summary__actions">
        <a href={`/articles/${article.slug}`}>Read article <span aria-hidden="true">→</span></a
        >{#if article.audio}<a href={`/articles/${article.slug}#article-audio`}>Listen</a>{/if}
      </p>
    {/if}
  </div>
</article>

<style>
  .article-summary {
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-start;
    gap: 2rem;
    min-width: 0;
  }
  .article-summary__cover {
    width: 12rem;
    aspect-ratio: 16/9;
    object-fit: cover;
    flex-shrink: 0;
  }
  .article-summary__text {
    min-width: 0;
    flex: 1;
  }
  .article-summary__title {
    margin: 0 0 0.75rem;
    font-family: var(--font-sans);
    font-size: 1.75rem;
    font-weight: 500;
    letter-spacing: -0.035em;
    line-height: 1.15;
  }
  .article-summary__title a {
    color: var(--foundation-ink);
    text-decoration: none;
  }
  .article-summary__title a:hover {
    color: var(--foundation-link);
    text-decoration: underline;
  }
  .article-summary__excerpt {
    margin: 0 0 0.875rem;
    color: var(--foundation-muted);
    font-size: 1rem;
    line-height: 1.55;
  }
  .article-summary__meta,
  .article-summary__eyebrow {
    margin: 0;
    color: var(--foundation-muted);
    font-size: 0.8125rem;
  }
  .article-summary__category {
    color: var(--foundation-accent);
    text-decoration: none;
  }
  .article-summary__eyebrow {
    color: var(--foundation-accent);
    margin-bottom: 1rem;
  }
  .article-summary--lead {
    flex-direction: row;
    align-items: center;
    gap: 3rem;
  }
  .article-summary--lead .article-summary__cover {
    width: 58%;
  }
  .article-summary--lead .article-summary__title {
    font-size: clamp(2.25rem, 4vw, 3.5rem);
  }
  .article-summary--lead .article-summary__excerpt {
    font-size: 1.125rem;
  }
  .article-summary__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    margin: 1rem 0 0;
    font-size: 0.875rem;
  }
  .article-summary__actions a {
    padding: 0.75rem 1.125rem;
    text-decoration: none;
  }
  .article-summary__actions a:first-child {
    color: var(--foundation-paper);
    background: var(--foundation-accent);
    border-radius: 3px;
  }
  @media (max-width: 760px) {
    .article-summary {
      gap: 1.25rem;
    }
    .article-summary__cover {
      width: 28%;
    }
    .article-summary__title {
      font-size: 1.35rem;
    }
    .article-summary--lead {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
    }
    .article-summary--lead .article-summary__cover {
      width: 100%;
    }
    .article-summary--lead .article-summary__title {
      font-size: 2.5rem;
    }
  }
</style>
