<script lang="ts">
  import ReaderShell from './ReaderShell.svelte';
  import type { LayoutData } from './$types';
  let { children, data }: { children: import('svelte').Snippet; data?: LayoutData } = $props();
</script>

<svelte:head>
  <link rel="alternate" type="application/rss+xml" title="Jelementi podcast" href="/podcast.xml" />
  <link rel="alternate" type="application/rss+xml" title="Jelementi articles" href="/feed.xml" />
</svelte:head>

<ReaderShell
  topics={data?.topics}
  storyCount={data?.storyCount}
  newestPublishedAt={data?.newestPublishedAt}>{@render children()}</ReaderShell
>
