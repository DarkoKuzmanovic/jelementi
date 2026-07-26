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
