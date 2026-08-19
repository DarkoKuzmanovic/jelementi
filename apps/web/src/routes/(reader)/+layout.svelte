<script lang="ts">
  import ReaderShell from './ReaderShell.svelte';

  let { children } = $props();
</script>

<!--
  Reader shell — persistent low-chrome chrome (#98). Every public route
  renders inside this shell: working bypass link, one main landmark,
  Jelementi Home, Categories, Search, and About navigation at all widths
  (conventional wrapping, never hidden behind a menu), and quiet footer
  recovery links. Static markup only — no hydration added. Studio routes
  render without this shell; they have their own StudioShell boundary.
  The shared component also lets the root static fallback render this exact
  shell without introducing a shared runtime application shell (#103).
-->
<ReaderShell>{@render children()}</ReaderShell>
