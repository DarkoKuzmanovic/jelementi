import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectHomeCatalog } from './home-catalog';

function article(n: number, category = 'History'): ArticleIndexEntry {
  return {
    slug: `story-${String(n).padStart(2, '0')}`,
    title: `Story ${n}`,
    excerpt: `Excerpt ${n}`,
    publishedAt: `2026-08-${String(28 - n).padStart(2, '0')}`,
    updatedAt: '2026-08-28',
    category,
    categorySlug: category.toLowerCase(),
    tags: [],
    author: 'Jelementi',
    cover: { src: `https://example.test/${n}.webp`, alt: `Cover ${n}` },
    readingTimeMinutes: 3,
    searchText: `${n}`,
  };
}

describe('Home catalog projection', () => {
  it('selects the newest lead, next seven stories, and non-repeating shelves without mutating input', () => {
    const input = Array.from({ length: 15 }, (_, n) => article(n));
    const reversed = [...input].reverse();
    const home = projectHomeCatalog(reversed);
    expect(home.lead).toEqual(input[0]);
    expect(home.recent).toEqual(input.slice(1, 8));
    expect(home.shelves[0]).toMatchObject({
      total: 15,
      compact: false,
      entries: input.slice(8, 11),
    });
    const slugs = [
      home.lead!,
      ...home.recent,
      ...home.shelves.flatMap((shelf) => shelf.entries),
    ].map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(reversed).toEqual([...input].reverse());
  });

  it('breaks date ties by slug, independent of updatedAt', () => {
    const a = article(0),
      b = { ...article(1), publishedAt: a.publishedAt, updatedAt: '2030-01-01' };
    expect(projectHomeCatalog([b, a]).lead).toEqual(a);
  });

  it('uses category totals for the big three/small split, caps small shelves at two and omits exhausted categories', () => {
    const newest = Array.from({ length: 8 }, (_, n) => article(n, 'Exhausted'));
    const rest = ['Places', 'Science', 'History', 'Nature'].flatMap((cat, i) =>
      Array.from({ length: 4 - i }, (_, n) => ({ ...article(8 + n, cat), slug: `${cat}-${n}` })),
    );
    const home = projectHomeCatalog([...newest, ...rest]);
    expect(home.shelves.map((s) => [s.category, s.compact, s.entries.length])).toEqual([
      ['Places', false, 3],
      ['Science', false, 3],
      ['History', true, 2],
      ['Nature', true, 1],
    ]);
    expect(home.shelves.some((s) => s.category === 'Exhausted')).toBe(false);
  });

  it('features only the newest series and excludes its parts from shelves', () => {
    const parts = [article(10, 'Places'), article(11, 'Places')].map((a, i) => ({
      ...a,
      series: { slug: 'ridge', title: 'Ridge', part: i + 1 },
    }));
    const older = [article(12, 'Places'), article(13, 'Places')].map((a, i) => ({
      ...a,
      series: { slug: 'valley', title: 'Valley', part: i + 1 },
    }));
    const home = projectHomeCatalog([
      ...Array.from({ length: 8 }, (_, n) => article(n)),
      ...parts,
      ...older,
    ]);
    expect(home.series?.slug).toBe('ridge');
    expect(home.series?.totalMinutes).toBe(6);
    expect(home.shelves.flatMap((s) => s.entries).map((a) => a.slug)).not.toEqual(
      expect.arrayContaining(parts.map((a) => a.slug)),
    );
    expect(home.shelves.flatMap((s) => s.entries)).toEqual(older);
  });

  it('leaves no empty tiers for empty, sparse or intermediate catalogs', () => {
    for (const count of [0, 1, 4]) {
      const home = projectHomeCatalog(Array.from({ length: count }, (_, n) => article(n)));
      expect(home.lead?.slug).toBe(count ? 'story-00' : undefined);
      expect(home.recent).toHaveLength(Math.max(0, count - 1));
      expect(home.shelves).toEqual([]);
      expect(home.series).toBeUndefined();
    }
  });
});
