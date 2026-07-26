<script lang="ts">
  import type { PageData } from './$types';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.article.title} — Jelementi</title></svelte:head>
<ArticleRenderer document={data.article} />
