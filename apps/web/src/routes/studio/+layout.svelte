<script lang="ts">
  import StudioShell from '../../lib/studio/StudioShell.svelte';
  let { children } = $props();
</script>

<svelte:head><title>Studio — Jelementi</title></svelte:head>

<StudioShell heading="Publishing workspace">
  {@render children()}
</StudioShell>
