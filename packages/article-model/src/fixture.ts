import type { ArticleDocument } from './schema';

/**
 * Hand-made ArticleDocument fixture for Phase 0.
 *
 * Phase 1 replaces this with the output of the Markdown → ArticleDocument
 * compiler. For now it is constructed by hand and exercised by both the web
 * renderer and the article-model tests. It covers every Phase 0 block type
 * (paragraph, heading, image, fact callout) and both inline node kinds
 * (text with marks, link).
 */
export const sampleArticle: ArticleDocument = {
  schemaVersion: 1,
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  excerpt: "The story of the world's most remote permanent settlement.",
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['remote places', 'islands', 'communities'],
  author: 'Jelementi',
  cover: {
    src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover.webp',
    alt: 'The volcanic island of Tristan da Cunha in the South Atlantic',
  },
  readingTimeMinutes: 4,
  blocks: [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Pull up a map. Find ' },
        { type: 'text', value: 'South America', marks: ['emphasis'] },
        { type: 'text', value: ' on the left and ' },
        { type: 'text', value: 'Africa', marks: ['emphasis'] },
        { type: 'text', value: ' on the right.' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      id: 'a-rock-at-the-edge-of-the-world',
      children: [{ type: 'text', value: 'A Rock at the Edge of the World' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'The island has no airport and can only be reached by sea. ' },
        {
          type: 'link',
          href: 'https://example.org/tristan-da-cunha',
          children: [{ type: 'text', value: 'Read more about the settlement', marks: ['strong'] }],
        },
      ],
    },
    {
      type: 'image',
      src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/map.webp',
      alt: 'Map locating Tristan da Cunha in the South Atlantic',
      caption: [
        {
          type: 'text',
          value: 'Tristan da Cunha lies roughly 2,400 km from the nearest inhabited land.',
        },
      ],
    },
    {
      type: 'callout',
      variant: 'fact',
      title: 'No runway, no shortcut',
      children: [{ type: 'text', value: 'The journey from Cape Town takes several days by ship.' }],
    },
  ],
  references: [
    {
      title: 'Tristan da Cunha — Government and history',
      url: 'https://example.org/tristan-da-cunha',
    },
  ],
};
