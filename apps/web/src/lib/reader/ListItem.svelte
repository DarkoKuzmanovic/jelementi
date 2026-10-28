<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import { formatPublishedDate } from '../article/format-date';
  import Kicker from './Kicker.svelte';

  let { article, headingLevel = 2 }: { article: ArticleIndexEntry; headingLevel?: 2 | 3 | 4 } =
    $props();
</script>

<article class="list-item">
  <img src={article.cover.src} alt={article.cover.alt} width="220" height="147" loading="lazy" />
  <div class="text">
    <Kicker
      category={article.category}
      categorySlug={article.categorySlug}
      extra={`${article.readingTimeMinutes} min`}
    />
    <svelte:element this={`h${headingLevel}`} class="title">
      <a href={`/articles/${article.slug}`}>{article.title}</a>
    </svelte:element>
    <p class="excerpt">{article.excerpt}</p>
    <time datetime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
  </div>
</article>

<style>
  .list-item {
    display: flex;
    align-items: flex-start;
    gap: 32px;
    padding: 28px 0;
    border-bottom: 1px solid var(--foundation-rule);
  }
  img {
    display: block;
    width: 220px;
    height: 147px;
    flex: none;
    object-fit: cover;
    border-radius: 2px;
  }
  .text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 26px;
    font-weight: 500;
    line-height: 31px;
    letter-spacing: -0.01em;
  }
  a {
    color: var(--foundation-ink);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  a:focus-visible {
    outline: 2px solid var(--foundation-accent);
    outline-offset: 2px;
  }
  .excerpt {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: var(--foundation-muted);
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 26px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  time {
    color: var(--foundation-muted);
    font-family: var(--font-sans);
    font-size: 13px;
  }
  @media (max-width: 600px) {
    .list-item {
      gap: 16px;
      padding: 20px 0;
    }
    img {
      order: 1;
      width: 96px;
      height: 96px;
      border-radius: 3px;
    }
    .text {
      flex: 1;
    }
    .title {
      font-size: 20px;
      line-height: 24px;
    }
    .excerpt,
    time {
      display: none;
    }
  }
</style>
