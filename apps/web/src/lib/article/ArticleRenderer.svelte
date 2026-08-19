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

  import ArticleAudio from './ArticleAudio.svelte';
  let { document }: { document: ArticleDocument } = $props();
  const footnoteTargets = $derived(footnoteReferenceTargets(document.blocks));
</script>

<article id="article-top">
  <header class="article-opening">
    <p class="article-opening__category">
      <a href={`/categories/${categorySlug(document.category)}`}>{document.category}</a>
    </p>
    <h1 class="article-opening__title">{document.title}</h1>
    <p class="article-opening__excerpt">{document.excerpt}</p>
  </header>
  <ArticleAudio article={document} />
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
    <section aria-labelledby="footnotes-heading">
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
  .article-opening__category {
    margin: 0 0 var(--space-3);
    font-size: var(--text-small);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .article-opening__category a {
    color: var(--foundation-accent);
  }

  .article-opening__title {
    margin: 0 0 var(--space-4);
    font-family: var(--font-serif);
    font-size: var(--text-h1);
    line-height: var(--leading-heading);
  }

  .article-opening__excerpt {
    margin: 0;
    color: var(--foundation-muted);
    font-size: 1.1rem;
  }

  .endmatter-heading {
    font-family: var(--font-serif);
  }
</style>
