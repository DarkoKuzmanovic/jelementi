import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { collapseSeriesEntries, projectSeries, seriesPartTitle } from './series-projection';

function article(
  slug: string,
  publishedAt: string,
  part?: number,
  title = `Title ${slug}`,
): ArticleIndexEntry {
  return {
    slug,
    title,
    excerpt: `Excerpt ${slug}`,
    publishedAt,
    updatedAt: publishedAt,
    category: 'Places',
    categorySlug: 'places',
    tags: [],
    author: 'Jelementi',
    cover: { src: `https://example.test/${slug}.webp`, alt: `Cover ${slug}` },
    readingTimeMinutes: part ?? 2,
    searchText: slug,
    ...(part === undefined ? {} : { series: { slug: 'fortress', title: 'Fortress', part } }),
  };
}

const articles = [
  article('fortress-3', '2026-03-01', 3),
  article('ordinary', '2026-02-20'),
  article('fortress-1', '2026-01-01', 1, 'Fortress, part 1: The first wall'),
  article('fortress-2', '2026-02-01', 2, 'fortress, part 2: The next wall'),
];

describe('series projection', () => {
  it('groups series, orders parts numerically, and totals minutes', () => {
    const series = projectSeries(articles);

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      slug: 'fortress',
      title: 'Fortress',
      category: 'Places',
      categorySlug: 'places',
      totalMinutes: 6,
      parts: [
        { part: 1, slug: 'fortress-1' },
        { part: 2, slug: 'fortress-2' },
        { part: 3, slug: 'fortress-3' },
      ],
    });
  });
  it('orders distinct series by their newest published part', () => {
    const newer = {
      ...article('newer-1', '2026-04-01', 1),
      series: { slug: 'newer', title: 'Newer', part: 1 },
    };
    const newerSecond = {
      ...article('newer-2', '2026-04-02', 2),
      series: { slug: 'newer', title: 'Newer', part: 2 },
    };

    expect(projectSeries([...articles, newer, newerSecond]).map(({ slug }) => slug)).toEqual([
      'newer',
      'fortress',
    ]);
  });

  it('strips only the exact case-sensitive series title and part prefix', () => {
    const series = projectSeries(articles)[0];
    if (series === undefined) throw new Error('Expected a series projection.');

    expect(seriesPartTitle(series, series.parts[0]!)).toBe('The first wall');
    expect(seriesPartTitle(series, series.parts[1]!)).toBe('fortress, part 2: The next wall');
  });

  it('collapses a represented series once, links to part one, and uses the newest cover', () => {
    const projected = collapseSeriesEntries(articles, projectSeries(articles));

    expect(projected).toHaveLength(2);
    expect(projected[0]).toMatchObject({
      kind: 'series',
      href: 'fortress-1',
      title: 'Fortress · series in 3 parts',
      cover: articles[0]?.cover,
      readingTimeMinutes: 6,
    });
    expect(projected[1]).toEqual({ kind: 'article', article: articles[1] });
  });

  it('leaves articles outside declared series intact', () => {
    const projected = collapseSeriesEntries([articles[1]!], projectSeries(articles));
    expect(projected).toEqual([{ kind: 'article', article: articles[1] }]);
  });
  it('keeps one published part ordinary while the other parts remain drafts', () => {
    const publishedPart = article('fortress-1', '2026-03-01', 1);
    // Drafts are absent from the validated published index used by this projection.
    const series = projectSeries([publishedPart]);

    expect(series).toEqual([]);
    expect(collapseSeriesEntries([publishedPart], series)).toEqual([
      { kind: 'article', article: publishedPart },
    ]);
  });
});
