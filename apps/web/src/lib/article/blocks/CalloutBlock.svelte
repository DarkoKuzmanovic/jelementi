<script lang="ts">
  import type { CalloutBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block }: { block: CalloutBlock } = $props();
</script>

<aside class="callout" data-variant={block.variant}>
  {#if block.title}
    <p class="callout-title">{block.title}</p>
  {/if}
  <div class="callout-body">
    <InlineContent nodes={block.children} />
  </div>
</aside>
