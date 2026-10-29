<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  import Card from './Card.svelte';

  let {
    article,
    dateOnly = false,
    titleContent,
    afterDeck,
    headingLevel = 2,
    cardDesktop = false,
    gridDesktop = false,
    kickerExtra,
  }: {
    article: ArticleIndexEntry;
    dateOnly?: boolean;
    titleContent?: Snippet;
    afterDeck?: Snippet;
    headingLevel?: 2 | 3 | 4;
    cardDesktop?: boolean;
    gridDesktop?: boolean;
    kickerExtra?: string;
  } = $props();
</script>

<div class="list-item" class:list-item--card={cardDesktop} class:list-item--grid={gridDesktop}>
  <Card
    {article}
    {dateOnly}
    {titleContent}
    {afterDeck}
    {headingLevel}
    showDeck
    kickerExtra={kickerExtra ?? (gridDesktop ? `${article.readingTimeMinutes} min` : undefined)}
  />
</div>
