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
      {#each headings as heading, index (heading.id)}<li>
          <a href={`#${heading.id}`}
            >{headingText(heading.children).trim() || `Section ${index + 1}`}</a
          >
        </li>{/each}
    </ol>
    {#if data.article.references.length > 0}<a href="#sources-heading">Sources →</a>{/if}
  </nav>
{/snippet}
<div class="article-page">
  <ArticleRenderer document={data.article} contents={headings.length > 0 ? contents : undefined} />
  <ArticleContinuation article={data.article} nextOlder={data.continuation.nextOlder} />
</div>
