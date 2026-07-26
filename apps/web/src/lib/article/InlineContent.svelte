<script lang="ts">
  import type { InlineNode, Mark } from '@jelementi/article-model';

  let { nodes }: { nodes: InlineNode[] } = $props();

  function assertExhaustive(node: never): never {
    throw new Error(`Unsupported inline node type: ${JSON.stringify(node)}`);
  }
</script>

{#snippet renderText(value: string, marks: Mark[])}
  {#if marks.length === 0}
    {value}
  {:else if marks[0] === 'strong'}
    <strong>{@render renderText(value, marks.slice(1))}</strong>
  {:else if marks[0] === 'emphasis'}
    <em>{@render renderText(value, marks.slice(1))}</em>
  {:else if marks[0] === 'code'}
    <code>{@render renderText(value, marks.slice(1))}</code>
  {:else if marks[0] === 'strikethrough'}
    <s>{@render renderText(value, marks.slice(1))}</s>
  {:else}
    {@render renderText(value, marks.slice(1))}
  {/if}
{/snippet}

{#snippet renderNode(node: InlineNode)}
  {#if node.type === 'text'}
    {@render renderText(node.value, node.marks ?? [])}
  {:else if node.type === 'link'}
    <a href={node.href}
      >{#each node.children as child, index (index)}{@render renderNode(child)}{/each}</a
    >
  {:else}
    {assertExhaustive(node)}
  {/if}
{/snippet}

{#each nodes as node, index (index)}
  {@render renderNode(node)}
{/each}
