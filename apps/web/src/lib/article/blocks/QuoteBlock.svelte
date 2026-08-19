<script lang="ts">
  import type { QuoteBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block, scope }: { block: QuoteBlock; scope: string } = $props();
</script>

<blockquote>
  <p><InlineContent nodes={block.children} {scope} /></p>
  {#if block.attribution}
    <footer>— {block.attribution}</footer>
  {/if}
</blockquote>

<style>
  blockquote {
    margin: var(--space-6) 0;
    padding-left: var(--space-4);
    border-left: 2px solid var(--foundation-rule);
    color: var(--foundation-ink);
  }

  blockquote p {
    margin: 0;
  }

  blockquote footer {
    margin-top: var(--space-2);
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }
</style>
