<script lang="ts">
  import type { ParagraphBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: ParagraphBlock; scope: string } = $props();
</script>

<p><InlineContent nodes={block.children} {scope} /></p>
