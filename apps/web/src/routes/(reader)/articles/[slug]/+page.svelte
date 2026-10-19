<script lang="ts">
  import type { PageData } from './$types';
  import type { InlineNode } from '@jelementi/article-model';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';
  import ArticleContinuation from '$lib/article/ArticleContinuation.svelte';
  let { data }: { data: PageData } = $props();
  const headings = $derived(data.article.blocks.filter((block) => block.type === 'heading'));

  // Contents labels are plain text: nested links and reference IDs belong only in the body.
  function headingText(nodes: InlineNode[]): string {
    return nodes
      .map((node) =>
        node.type === 'text' ? node.value : node.type === 'link' ? headingText(node.children) : '',
      )
      .join('');
  }
</script>

<svelte:head>
  <title>{data.article.title} — Jelementi</title>
  <meta name="description" content={data.article.excerpt} />
  <meta name="jelementi-content-version" content={data.contentVersion} />
</svelte:head>
{#snippet contents()}
  <nav class="article-contents" aria-label="In this article">
    <p>In this article</p>
    <ol>
      {#each headings as heading (heading.id)}<li>
          <a href={`#${heading.id}`}>{headingText(heading.children)}</a>
        </li>{/each}
    </ol>
    {#if data.article.references.length > 0}<a href="#sources-heading">Sources →</a>{/if}
  </nav>
{/snippet}
<div class="article-page">
  <ArticleRenderer document={data.article} contents={headings.length > 0 ? contents : undefined} />
  <ArticleContinuation article={data.article} nextOlder={data.continuation.nextOlder} />
</div>

<style>
  :global(.reader-surface:has(.article-page) .layout) {
    width: min(71.25rem, calc(100% - 2.75rem));
    padding-top: 3rem;
  }
  .article-page {
    --article-heading-font: var(--font-sans);
    --article-prose-font: var(--font-serif);
    --article-title-size: clamp(2.6875rem, 5.5vw, 4.875rem);
    --article-dek-size: clamp(1.1875rem, 1.65vw, 1.4375rem);
    --article-prose-size: clamp(1.25rem, 1.65vw, 1.4375rem);
    --article-section-size: clamp(1.75rem, 2.4vw, 2.125rem);
    --article-prose-width: 42.5rem;
    --article-cover-width: 71.25rem;
  }
  .article-contents {
    font-size: 0.9375rem;
  }
  .article-contents p {
    margin: 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--foundation-rule);
  }
  .article-contents ol {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }
  .article-contents li {
    margin-bottom: 1.25rem;
  }
  .article-contents a {
    text-decoration: none;
  }
  .article-contents a:hover {
    text-decoration: underline;
  }
  @media (max-width: 600px) {
    :global(.reader-surface:has(.article-page) .layout) {
      padding-top: 1.25rem;
    }
    .article-page :global(.article-cover) {
      margin-inline: -1.375rem;
      width: calc(100% + 2.75rem);
    }
  }
</style>
