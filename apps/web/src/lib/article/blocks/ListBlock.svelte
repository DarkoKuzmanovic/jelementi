<script lang="ts">
  import type { ListBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: ListBlock; scope: string } = $props();
</script>

{#if block.ordered}
  <ol>
    {#each block.items as item, index (index)}
      <li><InlineContent nodes={item} scope={`${scope}-item-${index}`} /></li>
    {/each}
  </ol>
{:else}
  <ul>
    {#each block.items as item, index (index)}
      <li><InlineContent nodes={item} scope={`${scope}-item-${index}`} /></li>
    {/each}
  </ul>
{/if}
