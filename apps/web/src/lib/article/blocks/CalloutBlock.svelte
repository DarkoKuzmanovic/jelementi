<script lang="ts">
  import type { CalloutBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: CalloutBlock; scope: string } = $props();
</script>

<aside
  class={`callout callout-${block.variant}`}
  aria-label={block.title ?? `${block.variant} note`}
>
  {#if block.variant === 'fact'}<p class="callout-kicker">Did you know</p>{/if}
  {#if block.title}
    <p class="callout-title">{block.title}</p>
  {/if}
  <p class="callout-body"><InlineContent nodes={block.children} {scope} /></p>
</aside>

<style>
  .callout {
    border-left: 3px solid var(--foundation-accent);
    background: var(--foundation-accent-soft);
    padding: var(--space-3) var(--space-4);
    margin: var(--space-6) 0;
    border-radius: var(--radius-control);
  }

  .callout-kicker {
    margin: 0 0 var(--space-2);
    color: var(--foundation-accent);
    font: 600 11px/1.3 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (min-width: 1240px) {
    .callout-fact {
      float: right;
      clear: right;
      width: 200px;
      margin: 0 -260px var(--space-4) var(--space-4);
      font-size: 15px;
      line-height: 1.45;
    }
  }

  .callout-title {
    font-weight: 700;
    margin: 0 0 var(--space-2);
  }

  .callout-body {
    margin: 0;
  }

  .callout-body p {
    margin: 0;
  }
</style>
