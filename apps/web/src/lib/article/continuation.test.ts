import { describe, expect, it } from 'vitest';
import { categorySlug } from '@jelementi/article-model';
import type { ArticleIndex } from '@jelementi/article-model';
import { articleContinuation } from './continuation';

// Newest-first is the canonical category sequence (issue #96, #101): the
// index used here is deliberately ordered oldest-first so the projection
// cannot pass by assuming position order; it must derive the newest-first
// sequence from the canonical category ordering.
const index: ArticleIndex = [
  {
    slug: 'oldest',
    title: 'Oldest',
    excerpt: 'e',
    publishedAt: '2026-08-08',
    updatedAt: '2026-08-08',
    category: 'Field Notes',
    categorySlug: categorySlug('Field Notes'),
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://example.org/oldest.webp', alt: 'Oldest cover' },
    readingTimeMinutes: 3,
    searchText: 'oldest',
  },
  {
    slug: 'middle',
    title: 'Middle',
    excerpt: 'e',
    publishedAt: '2026-08-15',
    updatedAt: '2026-08-15',
    category: 'Field Notes',
    categorySlug: categorySlug('Field Notes'),
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://example.org/middle.webp', alt: 'Middle cover' },
    readingTimeMinutes: 3,
    searchText: 'middle',
  },
  {
    slug: 'newest',
    title: 'Newest',
    excerpt: 'e',
    publishedAt: '2026-08-18',
    updatedAt: '2026-08-18',
    category: 'Field Notes',
    categorySlug: categorySlug('Field Notes'),
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://example.org/newest.webp', alt: 'Newest cover' },
    readingTimeMinutes: 3,
    searchText: 'newest',
  },
  {
    slug: 'other-category',
    title: 'Other',
    excerpt: 'e',
    publishedAt: '2026-08-20',
    updatedAt: '2026-08-20',
    category: 'Culture',
    categorySlug: categorySlug('Culture'),
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://example.org/other.webp', alt: 'Other cover' },
    readingTimeMinutes: 3,
    searchText: 'other',
  },
];

const documentSummary = (slug: string) => {
  const entry = index.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error('Fixture entry missing.');
  return { slug: entry.slug, category: entry.category };
};

describe('articleContinuation', () => {
  it('returns exactly one next-older article from the canonical newest-first category sequence', () => {
    expect(articleContinuation(index, documentSummary('newest')).nextOlder?.slug).toBe('middle');
    expect(articleContinuation(index, documentSummary('newest')).nextOlder?.title).toBe('Middle');
  });

  it('keeps continuation inside the same category and never crosses it', () => {
    expect(articleContinuation(index, documentSummary('newest')).nextOlder?.categorySlug).toBe(
      'field-notes',
    );
    // A Culture article never continues into the Field Notes sequence.
    expect(articleContinuation(index, documentSummary('other-category')).nextOlder).toBeNull();
  });

  it('returns no continuation for the oldest article in its category', () => {
    expect(articleContinuation(index, documentSummary('oldest')).nextOlder).toBeNull();
  });

  it('returns no continuation when the article is absent from the index', () => {
    expect(
      articleContinuation(index, { slug: 'ghost', category: 'Field Notes' }).nextOlder,
    ).toBeNull();
  });
});
