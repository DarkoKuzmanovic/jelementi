<script lang="ts">
  import type { HeadingBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  import { assertExhaustiveHeadingLevel } from '../exhaustive';
  let { block }: { block: HeadingBlock } = $props();
</script>

{#if block.level === 2}
  <h2 id={block.id}><InlineContent nodes={block.children} /></h2>
{:else if block.level === 3}
  <h3 id={block.id}><InlineContent nodes={block.children} /></h3>
{:else if block.level === 4}
  <h4 id={block.id}><InlineContent nodes={block.children} /></h4>
{:else}
  {assertExhaustiveHeadingLevel(block.level)}
{/if}
