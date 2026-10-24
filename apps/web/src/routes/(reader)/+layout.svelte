<script lang="ts">
  import ReaderShell from './ReaderShell.svelte';

  let {
    children,
    data,
  }: { children: import('svelte').Snippet; data?: { topics: { name: string; slug: string }[] } } =
    $props();
</script>

<svelte:head>
  <link rel="alternate" type="application/rss+xml" title="Jelementi podcast" href="/podcast.xml" />
  <link rel="alternate" type="application/rss+xml" title="Jelementi articles" href="/feed.xml" />
</svelte:head>

<!--
  Reader shell — persistent low-chrome chrome (#98). Every public route
  renders inside this shell: working bypass link, one main landmark,
  Jelementi Home, Categories, Search, and About navigation at all widths
  (conventional wrapping, never hidden behind a menu), and quiet footer
  recovery links. Static markup only — no hydration added.
  The shared component also lets the root static fallback render this exact
  shell without introducing a shared runtime application shell (#103).
-->
<ReaderShell topics={data?.topics}>{@render children()}</ReaderShell>
