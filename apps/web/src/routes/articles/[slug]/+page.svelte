<script lang="ts">
  import type { PageData } from './$types';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';
  let { data }: { data: PageData } = $props();
</script>

<ArticleRenderer document={data.article} />
