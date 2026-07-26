<script lang="ts">
  import { categorySlug, type ArticleDocument } from '@jelementi/article-model';
  import ParagraphBlock from './blocks/ParagraphBlock.svelte';
  import HeadingBlock from './blocks/HeadingBlock.svelte';
  import ImageBlock from './blocks/ImageBlock.svelte';
  import ListBlock from './blocks/ListBlock.svelte';
  import QuoteBlock from './blocks/QuoteBlock.svelte';
  import CalloutBlock from './blocks/CalloutBlock.svelte';
  import DividerBlock from './blocks/DividerBlock.svelte';
  import InlineContent from './InlineContent.svelte';
  import { assertExhaustiveBlock } from './exhaustive';
  import { footnoteReferenceTargets } from './footnotes';

  let { document }: { document: ArticleDocument } = $props();
  const footnoteTargets = $derived(footnoteReferenceTargets(document.blocks));
</script>

<article id="article-top">
  <header>
    <p><a href={`/categories/${categorySlug(document.category)}`}>{document.category}</a></p>
    <h1>{document.title}</h1>
    <p class="excerpt">{document.excerpt}</p>
  </header>
  {#each document.blocks as block, index (index)}
    {#if block.type === 'paragraph'}
      <ParagraphBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'heading'}
      <HeadingBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'image'}
      <ImageBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'list'}
      <ListBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'quote'}
      <QuoteBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'callout'}
      <CalloutBlock {block} scope={`block-${index}`} />
    {:else if block.type === 'divider'}
      <DividerBlock />
    {:else}
      {assertExhaustiveBlock(block)}
    {/if}
  {/each}
  {#if document.references.length > 0}
    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <ul>
        {#each document.references as reference, index (index)}
          <li>
            <a href={reference.url}>{reference.title}</a>
            {#if reference.publisher}
              <span> — {reference.publisher}</span>{/if}
            {#if reference.accessedAt}
              <span> (accessed {reference.accessedAt})</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if document.footnotes.length > 0}
    <section aria-labelledby="footnotes-heading">
      <h2 id="footnotes-heading">Footnotes</h2>
      <ol>
        {#each document.footnotes as footnote (footnote.id)}
          <li id={`footnote-${footnote.id}`}>
            <InlineContent nodes={footnote.children} scope={`footnote-${footnote.id}`} />
            {#each footnoteTargets[footnote.id] ?? [] as target, index (target)}
              <a href={`#${target}`} aria-label={`Back to footnote reference ${index + 1}`}>↩</a>
            {/each}
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</article>
