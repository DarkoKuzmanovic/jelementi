<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<header class="site-header">
  <nav aria-label="Primary navigation">
    <a href="/">Jelementi</a>
    <a href="/search">Search</a>
    <a href="/about">About</a>
  </nav>
</header>
<main class="layout">
  {@render children()}
</main>
