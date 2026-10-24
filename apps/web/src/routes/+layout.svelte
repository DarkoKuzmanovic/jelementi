<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<!-- Root layout owns only the shared foundation import; the reader shell lives in `(reader)/+layout.svelte`. -->
{@render children()}
