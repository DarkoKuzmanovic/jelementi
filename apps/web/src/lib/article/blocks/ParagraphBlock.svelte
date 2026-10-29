<script lang="ts">
  import type { ParagraphBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let {
    block,
    scope,
    opening = false,
  }: { block: ParagraphBlock; scope: string; opening?: boolean } = $props();
</script>

<p class:article-lede={opening}><InlineContent nodes={block.children} {scope} {opening} /></p>
