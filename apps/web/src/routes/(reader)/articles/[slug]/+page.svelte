<script lang="ts">
  import type { PageData } from './$types';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';
  import ArticleContinuation from '$lib/article/ArticleContinuation.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.article.title} — Jelementi</title>
  <meta name="description" content={data.article.excerpt} />
  <meta name="jelementi-content-version" content={data.contentVersion} />
</svelte:head>
<div class="article-page">
  <ArticleRenderer document={data.article} />
  <ArticleContinuation article={data.article} nextOlder={data.continuation.nextOlder} />
</div>

<style>
  /*
    The Quiet Column (#101): the article route widens the shared 42rem
    reading main to a bounded 52rem measure, preserving the existing gutters
    and centering. This override ships only in this route's own stylesheet,
    so Home, category, Search, and About keep the 42rem column.
  */
  :global(.layout) {
    width: min(52rem, calc(100% - 2rem));
  }

  .article-page {
    width: 100%;
  }
</style>
