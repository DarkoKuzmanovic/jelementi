import type { EntryGenerator, PageServerLoad } from './$types';
import { generatedContent } from '../../../../lib/generated-content.server';
import { resolveCategory } from '../../../../lib/routes';
import { projectCategoryDirectory } from '../../../../lib/category-projection';
import { projectSeries, seriesPartTitle } from '../../../../lib/series/series-projection';
import type { ArticleIndexEntry } from '@jelementi/article-model';

interface SectionEntry {
  article: ArticleIndexEntry;
  series?: {
    title: string;
    minutes: number;
    parts: { slug: string; part: number; title: string }[];
  };
}

/** A series is one entry, opening at part 1, at the position of its newest part (articles are newest first). */
function sectionEntries(articles: readonly ArticleIndexEntry[]): SectionEntry[] {
  const series = new Map(projectSeries(articles).map((entry) => [entry.slug, entry]));
  const seen = new Set<string>();
  return articles.flatMap((article): SectionEntry[] => {
    const entry = article.series && series.get(article.series.slug);
    if (!entry) return [{ article }];
    if (seen.has(entry.slug)) return [];
    seen.add(entry.slug);
    const opener = articles.find(({ slug }) => slug === entry.parts[0]?.slug) ?? article;
    return [
      {
        article: opener,
        series: {
          title: entry.title,
          minutes: entry.totalMinutes,
          parts: entry.parts.map((part) => ({
            slug: part.slug,
            part: part.part,
            title: seriesPartTitle(entry, part),
          })),
        },
      },
    ];
  });
}

export const prerender = true;
export const csr = false;
export const entries: EntryGenerator = () =>
  [...new Set(generatedContent.index.map((article) => article.categorySlug))].map((category) => ({
    category,
  }));

export const load: PageServerLoad = ({ params }) => {
  const category = resolveCategory(generatedContent, params.category);
  return {
    ...category,
    items: sectionEntries(category.articles),
    otherCategories: projectCategoryDirectory(generatedContent.index)
      .filter(({ slug }) => slug !== params.category)
      .map(({ name, slug, count }) => ({ name, slug, count })),
  };
};
