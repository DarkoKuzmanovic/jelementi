<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import ParagraphBlock from './blocks/ParagraphBlock.svelte';
  import HeadingBlock from './blocks/HeadingBlock.svelte';
  import ImageBlock from './blocks/ImageBlock.svelte';
  import ListBlock from './blocks/ListBlock.svelte';
  import QuoteBlock from './blocks/QuoteBlock.svelte';
  import CalloutBlock from './blocks/CalloutBlock.svelte';
  import DividerBlock from './blocks/DividerBlock.svelte';
  import InlineContent from './InlineContent.svelte';
  import { assertExhaustiveBlock } from './exhaustive';

  let { document }: { document: ArticleDocument } = $props();
</script>

<article>
  <h1>{document.title}</h1>
  <p class="excerpt">{document.excerpt}</p>
  {#each document.blocks as block, index (index)}
    {#if block.type === 'paragraph'}
      <ParagraphBlock {block} />
    {:else if block.type === 'heading'}
      <HeadingBlock {block} />
    {:else if block.type === 'image'}
      <ImageBlock {block} />
    {:else if block.type === 'list'}
      <ListBlock {block} />
    {:else if block.type === 'quote'}
      <QuoteBlock {block} />
    {:else if block.type === 'callout'}
      <CalloutBlock {block} />
    {:else if block.type === 'divider'}
      <DividerBlock />
    {:else}
      {assertExhaustiveBlock(block)}
    {/if}
  {/each}
  {#if document.footnotes.length > 0}
    <section aria-labelledby="footnotes-heading">
      <h2 id="footnotes-heading">Footnotes</h2>
      <ol>
        {#each document.footnotes as footnote (footnote.id)}
          <li id={`footnote-${footnote.id}`}>
            <InlineContent nodes={footnote.children} />
            <a href={`#footnote-ref-${footnote.id}`}>↩</a>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</article>
