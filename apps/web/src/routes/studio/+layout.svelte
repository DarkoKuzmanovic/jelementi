<script lang="ts">
  let { children } = $props();
</script>

<svelte:head><title>Studio — Jelementi</title></svelte:head>

<section class="studio-shell" aria-labelledby="studio-heading">
  <header>
    <p class="eyebrow">Jelementi Studio</p>
    <h1 id="studio-heading">Publishing workspace</h1>
  </header>
  {@render children()}
</section>
