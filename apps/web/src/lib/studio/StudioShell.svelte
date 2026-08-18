<script lang="ts">
  import type { Snippet } from 'svelte';
  import './tokens.css';

  let {
    heading,
    eyebrow = 'Jelementi Studio',
    children,
  }: {
    heading: string;
    eyebrow?: string;
    children: Snippet;
  } = $props();
</script>

<!--
  StudioShell — the protected header/workspace/theme boundary (#73). Every
  Studio route renders inside this shell so the semantic token scope
  (`.studio-shell`, tokens.css) and light/dark boundary apply consistently.
  Purely presentational: it carries no lifecycle truth of its own.
-->
<div class="studio-shell">
  <header>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{heading}</h1>
  </header>
  {@render children()}
</div>
