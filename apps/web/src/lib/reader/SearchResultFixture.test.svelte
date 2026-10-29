<script lang="ts">
  import ListItem from './ListItem.svelte';
  import HighlightedText from './HighlightedText.svelte';
  import type { ArticleIndexEntry } from '@jelementi/article-model';
  const article: ArticleIndexEntry = {
    slug: 'test',
    title: 'Vinča <script>alert',
    excerpt: 'A story',
    publishedAt: '2026-01-01',
    updatedAt: '2026-01-01',
    category: 'History',
    categorySlug: 'history',
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://example.org/cover.webp', alt: '' },
    readingTimeMinutes: 1,
    searchText: 'vinca',
  };
</script>

<ListItem {article}>
  {#snippet titleContent()}<span class="search-match"
      ><HighlightedText text={article.title} query="vinca" /></span
    >{/snippet}
  {#snippet afterDeck()}<p>In the story</p>{/snippet}
</ListItem>
