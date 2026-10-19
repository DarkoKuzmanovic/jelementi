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
