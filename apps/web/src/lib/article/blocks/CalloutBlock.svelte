<script lang="ts">
  import type { CalloutBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: CalloutBlock; scope: string } = $props();
</script>

<aside
  class={`callout callout-${block.variant}`}
  aria-label={block.title ?? `${block.variant} note`}
>
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
