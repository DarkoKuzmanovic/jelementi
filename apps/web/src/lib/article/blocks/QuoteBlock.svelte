<script lang="ts">
  import type { QuoteBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: QuoteBlock; scope: string } = $props();
</script>

<blockquote>
  <p><InlineContent nodes={block.children} {scope} /></p>
  {#if block.attribution}
    <footer>— {block.attribution}</footer>
  {/if}
</blockquote>
