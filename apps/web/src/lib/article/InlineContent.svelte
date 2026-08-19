<script lang="ts">
  import type { InlineNode, Mark } from '@jelementi/article-model';
  import { footnoteReferenceId } from './footnotes';

  let { nodes, scope }: { nodes: InlineNode[]; scope: string } = $props();

  function assertExhaustive(node: never | undefined): never {
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
    {assertExhaustive(marks[0])}
  {/if}
{/snippet}

{#snippet renderNode(node: InlineNode, path: string)}
  {#if node.type === 'text'}
    {@render renderText(node.value, node.marks ?? [])}
  {:else if node.type === 'link'}
    <a href={node.href}
      >{#each node.children as child, index (index)}{@render renderNode(
          child,
          `${path}-${index}`,
        )}{/each}</a
    >
  {:else if node.type === 'footnoteReference'}
    <sup id={footnoteReferenceId(node.id, scope, path)}
      ><a href={`#footnote-${node.id}`}>[{node.id}]</a></sup
    >
  {:else}
    {assertExhaustive(node)}
  {/if}
{/snippet}

{#each nodes as node, index (index)}
  {@render renderNode(node, `${index}`)}
{/each}

<style>
  :global(sup a) {
    font-size: 0.75em;
    color: var(--foundation-link);
    text-underline-offset: 0.18em;
  }
</style>
