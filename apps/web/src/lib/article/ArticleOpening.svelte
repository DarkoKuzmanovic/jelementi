<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';

  let { article }: { article: ArticleDocument } = $props();
</script>

<!--
  Article opening — the compact Quiet Column opening hierarchy (Variant A,
  c548b7e): category, title, dek, author, publication date, reading time,
  then tags. The canonical category link uses the shared category slug so
  every article connects to discovery. Shared by the public article route
  and Studio preview through the authoritative ArticleRenderer.
-->
<header class="article-opening">
  <p class="article-opening__category">
    <a href={`/categories/${categorySlug(article.category)}`}>{article.category}</a>
  </p>
  <h1 class="article-opening__title">{article.title}</h1>
  <p class="article-opening__excerpt">{article.excerpt}</p>
  <p class="article-opening__meta">
    <span>By <strong>{article.author}</strong></span>
    <span aria-hidden="true"> · </span>
    {#if article.publishedAt}
      <time datetime={article.publishedAt}>
        {formatPublishedDate(article.publishedAt)}
      </time>
    {/if}
    {#if article.publishedAt}
      <span aria-hidden="true"> · </span>
    {/if}
    <span>{article.readingTimeMinutes} min read</span>
  </p>
  {#if article.tags.length > 0}
    <ul class="article-opening__tags" aria-label="Tags">
      {#each article.tags as tag (tag)}
        <li>{tag}</li>
      {/each}
    </ul>
  {/if}
</header>

<style>
  .article-opening {
    margin: 0 0 var(--space-6);
  }

  .article-opening__category {
    margin: 0 0 var(--space-3);
    font-size: var(--text-small);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .article-opening__category a {
    color: var(--foundation-accent);
  }

  .article-opening__title {
    margin: 0 0 var(--space-4);
    font-family: var(--font-serif);
    font-size: var(--text-h1);
    line-height: var(--leading-heading);
    overflow-wrap: anywhere;
  }

  .article-opening__excerpt {
    margin: 0 0 var(--space-3);
    color: var(--foundation-muted);
    font-size: 1.1rem;
    line-height: 1.45;
  }

  .article-opening__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.5rem;
    margin: 0;
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }

  .article-opening__meta strong {
    color: var(--foundation-ink);
    font-weight: 700;
  }

  .article-opening__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
  }

  .article-opening__tags li {
    padding: 0.15rem 0.6rem;
    border: 1px solid var(--foundation-rule);
    border-radius: var(--radius-pill);
    font-size: var(--text-small);
    color: var(--foundation-muted);
  }
</style>
