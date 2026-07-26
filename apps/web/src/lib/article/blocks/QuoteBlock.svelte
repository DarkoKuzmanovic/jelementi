<script lang="ts">
  import type { QuoteBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';

  let { block }: { block: QuoteBlock } = $props();
</script>

<blockquote>
  <p><InlineContent nodes={block.children} /></p>
  {#if block.attribution}
    <footer>— {block.attribution}</footer>
  {/if}
</blockquote>
