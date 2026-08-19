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

  Studio broadly consumes the shared Jelementi foundation (#98): palette
  foundations, neutral aliases, type foundations, spacing, radius, focus
  (via tokens.css aliasing), and visibly the shared serif wordmark
  identity. Studio-semantic status/danger/evidence roles and operational
  density remain surface-owned. Focus ownership lives in the token
  boundary (tokens.css), not a one-off component override.
-->
<div class="studio-shell">
  <header>
    <p class="eyebrow jelementi-wordmark">{eyebrow}</p>
    <h1>{heading}</h1>
  </header>
  {@render children()}
</div>
