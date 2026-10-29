<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import Card from './Card.svelte';

  let {
    article,
    headingLevel = 2,
    cardDesktop = false,
  }: {
    article: ArticleIndexEntry;
    headingLevel?: 2 | 3 | 4;
    cardDesktop?: boolean;
  } = $props();
</script>

<div class="list-item" class:list-item--card={cardDesktop}>
  <Card {article} {headingLevel} showDeck />
</div>
