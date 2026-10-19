<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import type { Snippet } from 'svelte';
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
  let { document, contents }: { document: ArticleDocument; contents?: Snippet } = $props();
  const footnoteTargets = $derived(footnoteReferenceTargets(document.blocks));
</script>

<!--
  Authoritative article renderer (spec #96, ticket #98): the ONE shared
  content renderer consumed by the public article route and Studio preview.
  Illustration-first composition (#146), optional native audio, complete body
  and endmatter. The reader route supplies its optional margin snippet;
  Studio receives only content, without reader navigation.
-->
<article id="article-top">
  <ArticleOpening article={document} />
  <figure class="article-cover" aria-label={document.cover.alt}>
    <img src={document.cover.src} alt={document.cover.alt} loading="eager" />
  </figure>
  <div class="article-reading" class:article-reading--with-contents={!!contents}>
    {#if contents}<aside class="article-margin">{@render contents()}</aside>{/if}
    <div class="article-reading__column">
      <ArticleAudio article={document} />
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
                  <a href={`#${target}`} aria-label={`Back to footnote reference ${index + 1}`}>↩</a
                  >
                {/each}
              </li>
            {/each}
          </ol>
        </section>
      {/if}
    </div>
  </div>
</article>

<style>
  .article-reading {
    max-width: 50rem;
    margin-inline: auto;
  }
  .article-margin {
    min-width: 0;
  }
  .article-reading__column {
    min-width: 0;
  }
  .article-reading--with-contents {
    display: grid;
    grid-template-columns: 13.125rem minmax(0, 42.5rem);
    gap: 4.375rem;
    max-width: none;
    margin-top: 3rem;
  }
  @media (max-width: 1000px) {
    .article-reading--with-contents {
      display: block;
    }
    .article-margin {
      display: none;
    }
  }

  /* The Quiet Column measure: prose and ordinary blocks hold a calm 39rem
     line, while figures can open to the 50rem media measure without widening
     the page. Long intrinsic content scrolls only inside its own box. */
  .article-body {
    max-width: 50rem;
    margin-inline: auto;
    font-family: var(--article-prose-font, var(--font-sans));
    font-size: var(--article-prose-size, clamp(1.04rem, 1.4vw, 1.14rem));
    line-height: 1.6;
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
    max-width: var(--article-prose-width, 39rem);
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
    font-family: var(--article-heading-font, var(--font-serif));
    font-size: var(--article-section-size, var(--text-h2));
    line-height: var(--leading-heading);
  }

  .article-body :global(> h3),
  .article-body :global(> h4) {
    margin-top: var(--space-8);
    margin-bottom: var(--space-3);
    font-family: var(--article-heading-font, var(--font-serif));
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
    max-width: var(--article-cover-width, 50rem);
    margin: 0 auto var(--space-8);
  }

  .article-cover img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .article-endmatter {
    max-width: 44rem;
    margin: var(--space-12) auto 0;
    padding-top: var(--space-6);
    border-top: 1px solid var(--foundation-rule);
  }

  .article-endmatter :global(li) {
    padding-block: 0.75rem;
    border-bottom: 1px solid var(--foundation-rule);
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }

  .endmatter-heading {
    font-family: var(--font-sans);
    font-size: var(--article-section-size, var(--text-small));
    font-weight: 500;
    line-height: 1.2;
  }
</style>
