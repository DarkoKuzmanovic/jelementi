<script lang="ts">
  import type { ListBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';

  let { block }: { block: ListBlock } = $props();
</script>

{#if block.ordered}
  <ol>
    {#each block.items as item, index (index)}
      <li><InlineContent nodes={item} /></li>
    {/each}
  </ol>
{:else}
  <ul>
    {#each block.items as item, index (index)}
      <li><InlineContent nodes={item} /></li>
    {/each}
  </ul>
{/if}
