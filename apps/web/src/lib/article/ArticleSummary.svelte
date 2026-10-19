<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  let {
    article,
    lead = false,
    audioAvailable = false,
    citationIds = [],
  }: {
    article: ArticleIndexEntry;
    lead?: boolean;
    audioAvailable?: boolean;
    citationIds?: string[];
  } = $props();
</script>

{#snippet metadata()}
  <p class="article-summary__meta">
    <a class="article-summary__category" href={`/categories/${article.categorySlug}`}
      >{article.category}</a
    >
    <span aria-hidden="true"> · </span>{article.readingTimeMinutes} min read
  </p>
{/snippet}

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
    {#if lead}<p class="article-summary__eyebrow">Latest article</p>{:else}{@render metadata()}{/if}
    <h2 class="article-summary__title">
      <a href={`/articles/${article.slug}`}>{article.title}</a>
    </h2>
    <p class="article-summary__excerpt">
      {lead
        ? article.excerpt.replace(/\[(\d+)\]/g, (marker, id: string) =>
            citationIds.includes(id) ? '' : marker,
          )
        : article.excerpt}
    </p>
    {#if lead}{@render metadata()}{/if}
    {#if lead}
      <p class="article-summary__actions">
        <a href={`/articles/${article.slug}`}>Read article <span aria-hidden="true">→</span></a
        >{#if audioAvailable}<a href={`/articles/${article.slug}#article-audio`}>Listen</a>{/if}
      </p>
    {/if}
    <time class="article-summary__date" class:visually-hidden={!lead} datetime={article.publishedAt}
      >{formatPublishedDate(article.publishedAt)}</time
    >
  </div>
</article>
