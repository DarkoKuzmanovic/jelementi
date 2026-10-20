<script lang="ts">
  import { articleAudioAnchor } from './audio-anchor';
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  let {
    article,
    lead = false,
    audioAvailable = false,
    headingLevel = 2,
  }: {
    article: ArticleIndexEntry;
    lead?: boolean;
    audioAvailable?: boolean;
    headingLevel?: 2 | 3 | 4;
  } = $props();
  const titleTag = $derived(`h${headingLevel}`);
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
    <svelte:element this={titleTag} class="article-summary__title">
      <a href={`/articles/${article.slug}`}>{article.title}</a>
    </svelte:element>
    <p class="article-summary__excerpt">
      {article.excerpt}
    </p>
    {#if lead}{@render metadata()}{/if}
    {#if lead}
      <p class="article-summary__actions">
        <a href={`/articles/${article.slug}`}>Read article <span aria-hidden="true">→</span></a
        >{#if audioAvailable}<a href={`/articles/${article.slug}#${articleAudioAnchor}`}>Listen</a
          >{/if}
      </p>
    {/if}
    <time class="article-summary__date" class:visually-hidden={!lead} datetime={article.publishedAt}
      >{formatPublishedDate(article.publishedAt)}</time
    >
  </div>
</article>
