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

  The shell shares the Jelementi foundation (#98) focus treatment;
  Studio-owned operational tokens, density, and lifecycle
  presentation remain scoped to `.studio-shell` and are unchanged.
-->
<div class="studio-shell">
  <header>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{heading}</h1>
  </header>
  {@render children()}
</div>

<style>
  .studio-shell {
    /* Share the Jelementi foundation focus treatment (#98) with the Reader. */
    --studio-focus: #1459d9;
  }

  @media (prefers-color-scheme: dark) {
    .studio-shell {
      --studio-focus: #93c5fd;
    }
  }
</style>
