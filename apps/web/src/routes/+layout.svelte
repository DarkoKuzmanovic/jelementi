<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<main class="layout">
  {@render children()}
</main>
