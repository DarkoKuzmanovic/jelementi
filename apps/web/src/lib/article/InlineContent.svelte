<script lang="ts">
  import type { InlineNode, Mark } from '@jelementi/article-model';
  import { getContext } from 'svelte';
  import type { ArticleDocument } from '@jelementi/article-model';
  import { footnoteReferenceId } from './footnotes';

  let {
    nodes,
    scope,
    opening = false,
  }: { nodes: InlineNode[]; scope: string; opening?: boolean } = $props();
  const references = getContext<() => ArticleDocument['references']>('article-references');
  function citation(node: InlineNode | undefined) {
    if (node?.type !== 'link' || node.children.length !== 1 || node.children[0]?.type !== 'text')
      return undefined;
    const marker = /^\[(\d+)\]$/.exec(node.children[0].value);
    const index = marker
      ? (references?.().findIndex(
          (ref, index) =>
            ref.url === node.href &&
            (/^\[(\d+)\] /.exec(ref.title)?.[1] ?? String(index + 1)) === marker[1],
        ) ?? -1)
      : -1;
    return marker && index >= 0
      ? { number: marker[1], target: `#reader:source:${index + 1}` }
      : undefined;
  }
  function citationRun(start: number) {
    const run = [];
    for (let index = start; index < nodes.length; index++) {
      const item = citation(nodes[index]);
      if (!item) break;
      run.push(item);
    }
    return run;
  }

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
      ><a href={`#reader:footnote:${node.id}`}>[{node.id}]</a></sup
    >
  {:else}
    {assertExhaustive(node)}
  {/if}
{/snippet}

{#each nodes as node, index (index)}
  {@const text =
    node.type === 'text' ? (citation(nodes[index + 1]) ? node.value.trimEnd() : node.value) : ''}
  {#if citation(node)}
    {#if !citation(nodes[index - 1])}
      <span class="article-citation"
        >&#8201;{#each citationRun(index) as item, offset (offset)}{#if offset > 0},&#8201;{/if}<a
            href={item.target}
            aria-label={`Source ${item.number}`}>{item.number}</a
          >{/each}</span
      >
    {/if}
  {:else if opening && index === 0 && node.type === 'text'}
    {@const phrase = text.match(/^.*?[,;:]|^\S+(?:\s+\S+){0,4}/)?.[0] ?? text}
    <span class="article-opening-phrase">{@render renderText(phrase, node.marks ?? [])}</span
    >{@render renderText(text.slice(phrase.length), node.marks ?? [])}
  {:else if node.type === 'text'}
    {@render renderText(text, node.marks ?? [])}
  {:else}
    {@render renderNode(node, `${index}`)}
  {/if}
{/each}

<style>
  :global(sup a) {
    font-size: 0.75em;
    color: var(--foundation-link);
    text-underline-offset: 0.18em;
  }
</style>
