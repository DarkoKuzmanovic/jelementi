<script lang="ts">
  import type { PageData } from './$types';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.article.title} — Jelementi</title>
  <meta name="jelementi-content-version" content={data.contentVersion} />
</svelte:head>
<ArticleRenderer document={data.article} />
