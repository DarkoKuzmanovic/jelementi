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
  import ArticleOpening from './ArticleOpening.svelte';
  import { assertExhaustiveBlock } from './exhaustive';
  import { footnoteReferenceTargets } from './footnotes';

  import ArticleAudio from './ArticleAudio.svelte';
  let { document }: { document: ArticleDocument } = $props();
  const footnoteTargets = $derived(footnoteReferenceTargets(document.blocks));
</script>

<!--
  Authoritative article renderer (spec #96, ticket #98): the ONE shared
  content renderer consumed by the public article route and Studio preview.
  Quiet Column composition (#101): compact opening, optional audio directly
  beneath it, cover, then the in-flow block sequence, and restrained
  endmatter. Reader-only continuation/navigation chrome never lives here —
  Studio preview must receive exactly this content-only renderer.
-->
<article id="article-top">
  <ArticleOpening article={document} />
  <ArticleAudio article={document} />
  <figure class="article-cover">
    <img src={document.cover.src} alt={document.cover.alt} loading="eager" />
  </figure>
  <div class="article-body">
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
  </div>
  {#if document.references.length > 0}
    <section class="article-endmatter" aria-labelledby="sources-heading">
      <h2 class="endmatter-heading" id="sources-heading">Sources</h2>
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
    <section class="article-endmatter" aria-labelledby="footnotes-heading">
      <h2 class="endmatter-heading" id="footnotes-heading">Footnotes</h2>
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

<style>
  /* The Quiet Column measure: prose and ordinary blocks hold a calm 39rem
     line, while figures can open to the 50rem media measure without widening
     the page. Long intrinsic content scrolls only inside its own box. */
  .article-body {
    max-width: 50rem;
    margin-inline: auto;
    font-size: clamp(1.04rem, 1.4vw, 1.14rem);
  }

  .article-body :global(> p),
  .article-body :global(> h2),
  .article-body :global(> h3),
  .article-body :global(> h4),
  .article-body :global(> ul),
  .article-body :global(> ol),
  .article-body :global(> blockquote),
  .article-body :global(> aside),
  .article-body :global(> hr) {
    max-width: 39rem;
    margin-left: auto;
    margin-right: auto;
  }

  .article-body :global(> p) {
    margin-top: 0;
    margin-bottom: 1.55rem;
  }

  .article-body :global(> h2) {
    margin-top: var(--space-12);
    margin-bottom: var(--space-4);
    font-family: var(--font-serif);
    font-size: var(--text-h2);
    line-height: var(--leading-heading);
  }

  .article-body :global(> h3),
  .article-body :global(> h4) {
    margin-top: var(--space-8);
    margin-bottom: var(--space-3);
    font-family: var(--font-serif);
    line-height: var(--leading-heading);
  }

  .article-body :global(> figure) {
    max-width: 50rem;
    overflow-x: auto;
  }

  .article-body :global(code) {
    overflow-wrap: anywhere;
  }

  .article-cover {
    max-width: 50rem;
    margin: 0 auto var(--space-8);
  }

  .article-cover img {
    display: block;
    width: 100%;
    height: auto;
  }

  .article-endmatter {
    max-width: 44rem;
    margin: var(--space-12) auto 0;
    padding-top: var(--space-6);
    border-top: 1px solid var(--foundation-rule);
  }

  .article-endmatter :global(li) {
    margin-bottom: var(--space-2);
    overflow-wrap: anywhere;
  }

  .endmatter-heading {
    font-family: var(--font-sans);
    font-size: var(--text-small);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
