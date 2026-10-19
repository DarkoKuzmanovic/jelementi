<script lang="ts">
  import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  let { article, nextOlder }: { article: ArticleDocument; nextOlder: ArticleIndexEntry | null } =
    $props();
</script>

<nav class="article-continuation" aria-label="Continue reading">
  {#if nextOlder}
    <div class="article-continuation__story">
      <div>
        <p>Next in {article.category}</p>
        <p class="article-continuation__meta">
          {nextOlder.category} · {nextOlder.readingTimeMinutes} min read ·
          <time datetime={nextOlder.publishedAt}>{formatPublishedDate(nextOlder.publishedAt)}</time>
        </p>
        <h2>
          <a
            class="article-continuation__next"
            href={`/articles/${nextOlder.slug}`}
            aria-label={`Next older article in ${article.category}: ${nextOlder.title}`}
            >{nextOlder.title}</a
          >
        </h2>
      </div>
      <img
        src={nextOlder.cover.src}
        alt={nextOlder.cover.alt}
        width="150"
        height="100"
        loading="lazy"
      />
    </div>
  {/if}
  <a class="article-continuation__category" href={`/categories/${categorySlug(article.category)}`}
    >← Return to {article.category}</a
  >
</nav>

<style>
  .article-continuation {
    margin-top: 3rem;
    border-top: 1px solid var(--foundation-rule);
    padding: 2rem 0;
  }
  .article-continuation__story {
    display: flex;
    justify-content: space-between;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .article-continuation__story > div {
    min-width: 0;
  }
  p {
    margin: 0 0 1rem;
    color: var(--foundation-link);
    font-size: 0.875rem;
  }
  .article-continuation__meta {
    color: var(--foundation-muted);
    font-size: 0.8125rem;
    margin-bottom: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: clamp(1.375rem, 2vw, 1.75rem);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.03em;
  }
  .article-continuation__next {
    color: var(--foundation-ink);
    text-decoration: none;
  }
  .article-continuation__next:hover {
    color: var(--foundation-link);
    text-decoration: underline;
  }
  img {
    width: 9.375rem;
    height: 6.25rem;
    object-fit: cover;
  }
  .article-continuation__category {
    display: inline-block;
    padding-block: 0.75rem;
    text-decoration: none;
    font-size: 0.9375rem;
  }
  @media (max-width: 600px) {
    img {
      width: 28%;
      height: auto;
      aspect-ratio: 3/2;
      align-self: center;
    }
  }
</style>
