<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';
  import { setContext, type Snippet } from 'svelte';
  import { categorySlug } from '@jelementi/article-model';
  import { categoryHue } from '../reader/category-hues';
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
  import { seriesPartTitle, type SeriesProjection } from '../series/series-projection';
  let {
    document,
    contents,
    series,
  }: { document: ArticleDocument; contents?: Snippet; series?: SeriesProjection } = $props();
  setContext('article-references', () => document.references);
  type ArticleReference = ArticleDocument['references'][number];
  const footnoteTargets = $derived(footnoteReferenceTargets(document.blocks));
</script>

<!--
  Authoritative article renderer (spec #96, ticket #98): the ONE shared
  content renderer consumed by the public article route.
  Illustration-first composition (#146), optional native audio, complete body
  and endmatter. The reader route supplies its optional margin snippet.
-->
<article style:--article-hue={categoryHue(categorySlug(document.category))}>
  {#snippet sourceRow(reference: ArticleReference, index: number)}
    {@const marker = /^\[(\d+)\] /.exec(reference.title)}
    {@const title = marker ? reference.title.slice(marker[0].length) : reference.title}
    {@const number = marker?.[1] ?? String(index + 1)}
    {@const domain = new URL(reference.url).hostname.replace(/^www\./, '')}
    <li class="article-source" id={`reader:source:${index + 1}`}>
      <span class="article-source__number">{number}</span>
      <div class="article-source__content">
        <!-- shortcut: source titles use paired single-asterisk emphasis only; extend if authored titles add other Markdown. -->
        <a
          class="article-source__title"
          href={reference.url}
          aria-label={title.replace(/\*([^*]+)\*/g, '$1')}
        >
          {#each title.split(/(\*[^*]+\*)/g) as part, partIndex (partIndex)}{#if partIndex % 2 === 1}<em
                >{part.slice(1, -1)}</em
              >{:else}{part}{/if}{/each}
        </a>
        <p class="article-source__domain">
          <span>{domain}</span>
          {#if reference.publisher}<span> · {reference.publisher}</span>{/if}
          {#if reference.accessedAt}<span> · accessed {reference.accessedAt}</span>{/if}
        </p>
      </div>
    </li>
  {/snippet}
  <ArticleOpening article={document} {series} />
  <figure class="article-cover" aria-label={document.cover.alt}>
    <img src={document.cover.src} alt={document.cover.alt} loading="eager" />
  </figure>
  {#if contents}
    <details class="article-mobile-contents">
      <summary
        >In this story · {document.blocks.filter(
          (block) => block.type === 'heading' && block.level === 2,
        ).length} parts and sources</summary
      >
      {@render contents()}
    </details>
  {/if}
  <div class="article-reading">
    {#if contents || series}
      <aside class="article-margin">
        {#if contents}{@render contents()}{/if}
        {#if series}
          <section class="article-series-margin" aria-labelledby="article-series-margin-heading">
            <h2 id="article-series-margin-heading">In this series</h2>
            <ol>
              {#each series.parts as part (part.slug)}
                <li>
                  <span class="article-series-margin__number">{part.part}</span>
                  {#if part.slug === document.slug}
                    <span aria-current="page">{seriesPartTitle(series, part)}</span>
                  {:else}
                    <a href={`/articles/${part.slug}`}>{seriesPartTitle(series, part)}</a>
                  {/if}
                </li>
              {/each}
            </ol>
          </section>
        {/if}
      </aside>
    {/if}
    <div class="article-reading__column">
      <div class="article-body">
        {#each document.blocks as block, index (index)}
          {#if block.type === 'paragraph'}
            <ParagraphBlock {block} scope={`block-${index}`} opening={index === 0} />
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
      <ArticleAudio article={document} />
      {#if document.references.length > 0}
        <section class="article-endmatter" aria-labelledby="reader:sources">
          <h2 class="endmatter-heading" id="reader:sources">Sources</h2>
          {#if document.references.length > 4}
            <ol class="article-sources" role="list">
              {#each document.references.slice(0, 4) as reference, index (index)}
                {@render sourceRow(reference, index)}
              {/each}
            </ol>
            <details class="article-sources__details">
              <summary>Show all {document.references.length} sources</summary>
              <ol class="article-sources" role="list" start="5">
                {#each document.references.slice(4) as reference, offset (offset)}
                  {@render sourceRow(reference, offset + 4)}
                {/each}
              </ol>
            </details>
          {:else}
            <ol class="article-sources" role="list">
              {#each document.references as reference, index (index)}
                {@render sourceRow(reference, index)}
              {/each}
            </ol>
          {/if}
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
    <aside class="article-facts" aria-label="Story notes">
      {#if document.tags.length}
        <p class="article-rail-label">Filed under</p>
        <ul aria-label="Tags">
          {#each document.tags as tag (tag)}<li>{tag}</li>{/each}
        </ul>
      {/if}
      <p class="article-facts__note">
        Small blue numbers point to the source list at the end of the story.
      </p>
    </aside>
  </div>
</article>
