<script lang="ts">
  import AboutContent from './AboutContent.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head
  ><title>About — Jelementi</title><meta
    name="description"
    content="About Jelementi — independent stories, carefully edited and researched from documented sources."
  /></svelte:head
>
<AboutContent storyCount={data.storyCount} categoryCount={data.categoryCount} />
