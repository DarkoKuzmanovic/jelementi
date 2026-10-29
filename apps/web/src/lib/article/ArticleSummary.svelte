<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  let {
    article,
    headingLevel = 2,
  }: {
    article: ArticleIndexEntry;
    headingLevel?: 2 | 3 | 4;
  } = $props();
  const titleTag = $derived(`h${headingLevel}`);
</script>

{#snippet metadata()}
  <p class="article-summary__meta">
    <a class="article-summary__category" href={`/categories/${article.categorySlug}`}
      >{article.category}</a
    >
    &#32;<span aria-hidden="true">·</span>&#32;{article.readingTimeMinutes} min read
  </p>
{/snippet}

<article class="article-summary">
  <img
    class="article-summary__cover"
    src={article.cover.src}
    alt={article.cover.alt}
    width="1600"
    height="900"
    loading="lazy"
  />
  <div class="article-summary__text">
    {@render metadata()}
    <svelte:element this={titleTag} class="article-summary__title">
      <a href={`/articles/${article.slug}`}>{article.title}</a>
    </svelte:element>
    <p class="article-summary__excerpt">
      {article.excerpt}
    </p>
    <time class="visually-hidden" datetime={article.publishedAt}
      >{formatPublishedDate(article.publishedAt)}</time
    >
  </div>
</article>
