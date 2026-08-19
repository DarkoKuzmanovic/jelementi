<script lang="ts">
  import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';

  let {
    article,
    nextOlder,
  }: {
    article: ArticleDocument;
    nextOlder: ArticleIndexEntry | null;
  } = $props();
</script>

<nav class="article-continuation" aria-label="Continue reading">
  <a href={`/categories/${categorySlug(article.category)}`}>← Return to {article.category}</a>
  {#if nextOlder}
    <a class="article-continuation__next" href={`/articles/${nextOlder.slug}`}>
      <small>Next older article in {article.category}</small>
      {nextOlder.title} →
    </a>
  {/if}
</nav>

<style>
  .article-continuation {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    align-items: center;
    border-block: 1px solid var(--foundation-rule);
    padding: var(--space-6) 0;
  }

  .article-continuation__next {
    margin-left: auto;
    text-align: right;
    font-weight: 700;
    color: var(--foundation-ink);
    text-decoration: none;
  }

  .article-continuation__next:hover {
    color: var(--foundation-link);
    text-decoration: underline;
  }

  .article-continuation__next small {
    display: block;
    margin-bottom: 0.2rem;
    color: var(--foundation-muted);
    font-size: var(--text-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
