<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.category} — Jelementi</title></svelte:head>
<section aria-labelledby="category-heading">
  <h1 id="category-heading">{data.category}</h1>
  <ul class="article-list">
    {#each data.articles as article (article.slug)}
      <li>
        <article>
          <h2><a href={`/articles/${article.slug}`}>{article.title}</a></h2>
          <p>{article.excerpt}</p>
        </article>
      </li>
    {/each}
  </ul>
</section>
