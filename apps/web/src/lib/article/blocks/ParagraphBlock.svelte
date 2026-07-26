<script lang="ts">
  import type { ParagraphBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block }: { block: ParagraphBlock } = $props();
</script>

<p>
  <InlineContent nodes={block.children} />
</p>
