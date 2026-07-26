<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import ParagraphBlock from './blocks/ParagraphBlock.svelte';
  import HeadingBlock from './blocks/HeadingBlock.svelte';
  import ImageBlock from './blocks/ImageBlock.svelte';
  import CalloutBlock from './blocks/CalloutBlock.svelte';
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
    {:else if block.type === 'callout'}
      <CalloutBlock {block} />
    {:else}
      {assertExhaustiveBlock(block)}
    {/if}
  {/each}
</article>
