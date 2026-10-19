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
<article>
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
        <section class="article-endmatter" aria-labelledby="reader:sources">
          <h2 class="endmatter-heading" id="reader:sources">Sources</h2>
          <ul role="list">
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
        <section class="article-endmatter" aria-labelledby="reader:footnotes">
          <h2 class="endmatter-heading" id="reader:footnotes">Footnotes</h2>
          <ol>
            {#each document.footnotes as footnote (footnote.id)}
              <li id={`reader:footnote:${footnote.id}`}>
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
