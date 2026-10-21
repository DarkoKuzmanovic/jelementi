<script lang="ts">
  import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
  import { categorySlug } from '@jelementi/article-model';
  import { formatPublishedDate } from './format-date';
  import { seriesPartTitle, type SeriesProjection } from '../series/series-projection';
  let {
    article,
    nextOlder,
    series,
  }: { article: ArticleDocument; nextOlder: ArticleIndexEntry | null; series?: SeriesProjection } =
    $props();
  const seriesPartIndex = $derived(series?.parts.findIndex(({ slug }) => slug === article.slug) ?? -1);
  const nextSeriesPart = $derived(
    series && seriesPartIndex >= 0 ? series.parts[seriesPartIndex + 1] : undefined,
  );
</script>

<nav class="article-continuation" aria-label="Continue reading">
  {#if series && nextSeriesPart}
    <p class="article-series-continuation__kicker">
      <span>Continue the series</span>
      <span aria-hidden="true"> · </span>
      <span>{series.title}</span>
    </p>
    <div class="article-series-continuation">
      <article class="article-series-continuation__story">
        <img
          src={nextSeriesPart.cover.src}
          alt={nextSeriesPart.cover.alt}
          width="1600"
          height="900"
          loading="lazy"
        />
        <div>
          <p class="article-continuation__meta">
            Part {nextSeriesPart.part} of {series.parts.length} · {nextSeriesPart.readingTimeMinutes}
            min read
          </p>
          <h2>
            <a class="article-continuation__next" href={`/articles/${nextSeriesPart.slug}`}
              >{seriesPartTitle(series, nextSeriesPart)}</a
            >
          </h2>
          <p class="article-series-continuation__excerpt">{nextSeriesPart.excerpt}</p>
          <a class="article-series-continuation__action" href={`/articles/${nextSeriesPart.slug}`}
            >Continue to part {nextSeriesPart.part} →</a
          >
        </div>
      </article>
      <aside class="article-series-continuation__list" aria-labelledby="article-series-whole-heading">
        <h2 id="article-series-whole-heading">The whole series</h2>
        <ol>
          {#each series.parts as part (part.slug)}
            <li>
              <span class="article-series-continuation__number">{part.part}</span>
              <div>
                {#if part.slug === article.slug}
                  <span aria-current="page">{seriesPartTitle(series, part)}</span>
                  <span class="article-series-continuation__status">You are here</span>
                {:else}
                  <a href={`/articles/${part.slug}`}>{seriesPartTitle(series, part)}</a>
                  <span class="article-series-continuation__status">
                    {part.slug === nextSeriesPart.slug ? 'Up next' : `${part.readingTimeMinutes} min`}
                  </span>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      </aside>
    </div>
    <a
      class="article-continuation__category"
      href={`/categories/${categorySlug(article.category)}`}
      >More in {article.category} →</a
    >
  {:else}
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
    <a
      class="article-continuation__category"
      href={`/categories/${categorySlug(article.category)}`}
      >← Return to {article.category}</a
    >
  {/if}
</nav>
