<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Jelementi</title></svelte:head>
<section class="home" aria-labelledby="home-heading">
  <h1 id="home-heading">Jelementi</h1>
  <p class="lede">A small English-language beta reader for curious, careful stories.</p>
  <ul class="article-list">
    {#each data.index as article (article.slug)}
      <li>
        <article>
          <h2><a href={`/articles/${article.slug}`}>{article.title}</a></h2>
          <p>{article.excerpt}</p>
          <p>
            <a href={`/categories/${article.categorySlug}`}>{article.category}</a> · {article.readingTimeMinutes}
            min read
          </p>
        </article>
      </li>
    {/each}
  </ul>
</section>
