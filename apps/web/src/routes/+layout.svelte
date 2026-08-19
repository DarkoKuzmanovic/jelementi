<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<!-- Surface-neutral root layout (spec #96, ticket #98): owns only the shared foundation import. Reader and Studio surfaces own their shells via structural route-group layouts — `(reader)/+layout.svelte` for public Reader routes and `studio/+layout.svelte` for the protected workspace. No Reader-versus-Studio branching exists in shared code; SvelteKit route groups keep public URLs unchanged while isolating surface ownership. -->
{@render children()}
