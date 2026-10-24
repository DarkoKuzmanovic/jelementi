import type { ArticleDocument } from '@jelementi/article-model';
import { inlineText } from '../article/article-html';
import type { GeneratedContent } from '../generated-content';
import type { SeriesPart, SeriesProjection } from './series-projection';

export interface DateCard {
  when: string;
  what: string;
}

/**
 * Cards from the list right after an article's "Dates to remember" heading.
 * Each item reads "<when>: <what>"; an item without a colon is skipped.
 */
export function datesToRemember(article: ArticleDocument): DateCard[] {
  const headingIndex = article.blocks.findIndex(
    (block) =>
      block.type === 'heading' &&
      inlineText(block.children).trim().toLowerCase() === 'dates to remember',
  );
  const list = article.blocks[headingIndex + 1];
  if (headingIndex < 0 || list?.type !== 'list') return [];
  return list.items.flatMap((item) => {
    const text = inlineText(item).trim();
    const colon = text.indexOf(': ');
    return colon > 0 ? [{ when: text.slice(0, colon), what: text.slice(colon + 2) }] : [];
  });
}

/** Series parts that have date cards, in part order. */
export function seriesDateParts(
  content: GeneratedContent,
  series: SeriesProjection,
): { part: SeriesPart; cards: DateCard[] }[] {
  return series.parts.flatMap((part) => {
    const article = content.articles[part.slug];
    const cards = article ? datesToRemember(article) : [];
    return cards.length > 0 ? [{ part, cards }] : [];
  });
}
