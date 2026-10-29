<script lang="ts">
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import Card from './Card.svelte';

  let {
    article,
    headingLevel = 2,
    cardDesktop = false,
    gridDesktop = false,
  }: {
    article: ArticleIndexEntry;
    headingLevel?: 2 | 3 | 4;
    cardDesktop?: boolean;
    gridDesktop?: boolean;
  } = $props();
</script>

<div class="list-item" class:list-item--card={cardDesktop} class:list-item--grid={gridDesktop}>
  <Card
    {article}
    {headingLevel}
    showDeck
    kickerExtra={gridDesktop ? `${article.readingTimeMinutes} min` : undefined}
  />
</div>
