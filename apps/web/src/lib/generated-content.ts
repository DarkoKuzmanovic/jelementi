import {
  ArticleDocumentSchema,
  ArticleIndexSchema,
  categorySlug,
  normalizeSearchText,
  type ArticleDocument,
  type ArticleIndex,
  type ArticleIndexEntry,
} from '@jelementi/article-model';

export interface GeneratedContent {
  index: ArticleIndex;
  articles: Readonly<Record<string, ArticleDocument>>;
}

const cardFields: ReadonlyArray<Exclude<keyof ArticleIndexEntry, 'categorySlug' | 'searchText'>> = [
  'slug',
  'title',
  'excerpt',
  'publishedAt',
  'updatedAt',
  'category',
  'tags',
  'author',
  'cover',
  'readingTimeMinutes',
];

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Validates the complete generated-data boundary before routes derive any data from it. */
export function validateGeneratedContent(
  rawIndex: unknown,
  rawArticles: Readonly<Record<string, unknown>>,
): GeneratedContent {
  const index = ArticleIndexSchema.parse(rawIndex);
  const entriesBySlug = new Map<string, ArticleIndexEntry>();
  for (const entry of index) {
    if (entriesBySlug.has(entry.slug)) {
      throw new Error(`Generated index contains duplicate slug: ${entry.slug}.`);
    }
    entriesBySlug.set(entry.slug, entry);
  }
  const articles: Record<string, ArticleDocument> = {};

  for (const [filename, rawDocument] of Object.entries(rawArticles)) {
    const document = ArticleDocumentSchema.parse(rawDocument);
    const filenameSlug = filename.replace(/\.json$/, '');
    if (filenameSlug !== document.slug && entriesBySlug.has(document.slug)) {
      throw new Error(`Generated article filename does not match document slug: ${filename}.`);
    }
    if (!entriesBySlug.has(filenameSlug)) {
      throw new Error(`Generated article artifact is orphaned: ${filename}.`);
    }
    if (document.status !== 'published') {
      throw new Error(`Generated article must be published: ${filename}.`);
    }
    const entry = entriesBySlug.get(document.slug);
    if (!entry) throw new Error(`Generated article artifact is orphaned: ${filename}.`);
    if (entry.categorySlug !== categorySlug(document.category)) {
      throw new Error(`Generated article category does not match its category slug: ${filename}.`);
    }
    for (const field of cardFields) {
      if (!sameValue(entry[field], document[field])) {
        throw new Error(`Generated article card metadata does not match document: ${filename}.`);
      }
    }
    articles[document.slug] = document;
  }

  for (const entry of index) {
    if (!articles[entry.slug]) {
      throw new Error(`Generated index entry has no article artifact: ${entry.slug}.`);
    }
  }
  return { index, articles };
}

/** Filters the generated small index with the same normalizer used at index creation. */
export function filterArticles(index: ArticleIndex, query: string): ArticleIndex {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return index;
  return index.filter((entry) => {
    const searchable = normalizeSearchText(
      [
        entry.title,
        entry.excerpt,
        entry.category,
        entry.tags.join(' '),
        entry.author,
        entry.searchText,
      ].join(' '),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export function articlesForCategory(index: ArticleIndex, slug: string): ArticleIndex {
  return index.filter((entry) => entry.categorySlug === slug);
}
