import {
  ArticleDocumentSchema,
  categorySlug,
  normalizeSearchText,
  type ArticleDocument,
  type ArticleIndexEntry,
} from '@jelementi/article-model';
import {
  validateGeneratedContent,
  type GeneratedContent,
} from '../apps/web/src/lib/generated-content';

export const READER_ACCEPTANCE_FIXTURE_MARKER = 'jelementi-reader-acceptance-fixture-v1';
export type ReaderAcceptanceScenario =
  'representative' | 'intermediate' | 'sparse' | 'ordinary-error';

const mediaOrigin = 'https://reader-acceptance.invalid/';

function text(value: string, marks?: ['strong', 'emphasis', 'code', 'strikethrough']) {
  return marks === undefined
    ? ({ type: 'text', value } as const)
    : ({ type: 'text', value, marks } as const);
}

const richDocument = ArticleDocumentSchema.parse({
  schemaVersion: 1,
  slug: 'acceptance-rich-column',
  title: 'Čačak Field Notes: Every Reader Structure',
  excerpt: 'A deterministic rich article for the Reader acceptance seam.',
  status: 'published',
  publishedAt: '2026-08-18',
  updatedAt: '2026-08-18',
  category: 'Field Notes',
  tags: ['Čačak', 'rich content', 'acceptance'],
  author: 'Jelementi',
  cover: { src: `${mediaOrigin}rich-cover.webp`, alt: 'Abstract acceptance cover' },
  audio: { src: `${mediaOrigin}rich-audio.mp3`, durationSeconds: 83 },
  readingTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      children: [
        text('All locked marks remain observable.', [
          'strong',
          'emphasis',
          'code',
          'strikethrough',
        ]),
        { type: 'footnoteReference', id: 'locked-seam' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      id: 'representative-heading',
      children: [text('A representative heading')],
    },
    {
      type: 'image',
      src: `${mediaOrigin}wide-image.webp`,
      alt: 'A wide deterministic fixture landscape',
      caption: [
        text('Fixture image with a '),
        {
          type: 'link',
          href: 'https://example.com/reader-acceptance',
          children: [text('conventional source link')],
        },
        text(' with a second citation'),
        { type: 'footnoteReference', id: 'locked-seam' },
      ],
      width: 1600,
      height: 900,
    },
    {
      type: 'list',
      ordered: true,
      items: [[text('First deterministic item')], [text('Second deterministic item')]],
    },
    {
      type: 'quote',
      children: [text('A quiet fixture can still prove a hard invariant.')],
      attribution: 'Acceptance harness',
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Fixture only',
      children: [text('This content must never enter a production bundle.')],
    },
    { type: 'divider' },
  ],
  footnotes: [
    {
      id: 'locked-seam',
      children: [text('The backlink target is derived by the authoritative renderer.')],
    },
  ],
  references: [
    {
      title: 'Reader acceptance source',
      url: 'https://example.com/reader-acceptance',
      publisher: 'Jelementi fixtures',
      accessedAt: '2026-08-18',
    },
  ],
});

interface MinimalDocumentOptions {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  excerpt?: string;
  tags?: string[];
}

function minimalDocument({
  slug,
  title,
  category,
  publishedAt,
  excerpt = `Deterministic summary for ${title}.`,
  tags = [],
}: MinimalDocumentOptions): ArticleDocument {
  return ArticleDocumentSchema.parse({
    schemaVersion: 1,
    slug,
    title,
    excerpt,
    status: 'published',
    publishedAt,
    updatedAt: publishedAt,
    category,
    tags,
    author: 'Jelementi',
    cover: { src: `${mediaOrigin}${slug}.webp`, alt: `Fixture cover for ${title}` },
    readingTimeMinutes: 3,
    blocks: [{ type: 'paragraph', children: [text(`Body for ${title}.`)] }],
    footnotes: [],
    references: [],
  });
}

const representativeDocuments = [
  richDocument,
  minimalDocument({
    slug: 'acceptance-field-middle',
    title: 'The Middle Field Note',
    category: 'Field Notes',
    publishedAt: '2026-08-15',
  }),
  minimalDocument({
    slug: 'acceptance-culture-new',
    title: 'Culture at the Newest Edge',
    category: 'Culture',
    publishedAt: '2026-08-12',
  }),
  minimalDocument({
    slug: 'acceptance-science-new',
    title: 'A Measured Sky',
    category: 'Science',
    publishedAt: '2026-08-10',
  }),
  minimalDocument({
    slug: 'acceptance-field-oldest',
    title: 'The Oldest Field Note',
    category: 'Field Notes',
    publishedAt: '2026-08-08',
  }),
  minimalDocument({
    slug: 'acceptance-culture-old',
    title: 'Culture in the Archive',
    category: 'Culture',
    publishedAt: '2026-08-05',
  }),
  minimalDocument({
    slug: 'acceptance-science-old',
    title: 'The Patient Instrument',
    category: 'Science',
    publishedAt: '2026-08-01',
  }),
  minimalDocument({
    slug: 'acceptance-long-category',
    title: 'A Single Thread at Narrow Width',
    category: 'A Deliberately Long Category Name for Narrow Readers',
    publishedAt: '2026-07-28',
    excerpt: 'unbroken-content-token-that-must-reflow-without-page-level-overflow',
  }),
  ArticleDocumentSchema.parse({
    schemaVersion: 1,
    slug: 'acceptance-no-audio-long-column',
    title: 'A Sparse Column Without Audio',
    excerpt: 'A deterministic sparse article with no audio and long content.',
    status: 'published',
    publishedAt: '2026-07-28',
    updatedAt: '2026-07-28',
    category: 'Solo',
    tags: ['sparse', 'quiet'],
    author: 'Jelementi',
    cover: { src: `${mediaOrigin}sparse-cover.webp`, alt: 'Sparse cover' },
    readingTimeMinutes: 2,
    blocks: [
      {
        type: 'paragraph',
        children: [
          text('A very long unbroken token that must stay contained inside the bounded column: '),
          text('x'.repeat(180)),
        ],
      },
      {
        type: 'image',
        src: `${mediaOrigin}wide-image.webp`,
        alt: 'A wide deterministic fixture landscape',
        caption: [text('A wide media caption that also stays contained.')],
        width: 1600,
        height: 900,
      },
      { type: 'divider' },
    ],
    footnotes: [],
    references: [],
  }),
  }),
] as const;

const excludedDocuments = [
  ArticleDocumentSchema.parse({
    ...minimalDocument({
      slug: 'acceptance-private-draft',
      title: 'Acceptance Draft Must Stay Private',
      category: 'Private',
      publishedAt: '2026-08-20',
    }),
    status: 'draft',
  }),
  ArticleDocumentSchema.parse({
    ...minimalDocument({
      slug: 'acceptance-archived-article',
      title: 'Acceptance Archive Must Stay Private',
      category: 'Private',
      publishedAt: '2026-08-19',
    }),
    status: 'archived',
  }),
] as const;

export const READER_ACCEPTANCE_EXCLUDED_TITLES = excludedDocuments.map(
  (document) => document.title,
);

const sparseDocuments = [
  minimalDocument({
    slug: 'acceptance-sparse-catalog',
    title: 'One Article Is Still a Catalog',
    category: 'Solo',
    publishedAt: '2026-01-01',
  }),
] as const;

function indexEntry(document: ArticleDocument): ArticleIndexEntry {
  if (document.publishedAt === undefined) {
    throw new Error(`Reader acceptance fixture is not published: ${document.slug}.`);
  }
  const searchableFields = [
    document.title,
    document.excerpt,
    document.category,
    document.tags.join(' '),
    document.author,
  ].join(' ');
  return {
    slug: document.slug,
    title: document.title,
    excerpt: document.excerpt,
    publishedAt: document.publishedAt,
    updatedAt: document.updatedAt,
    category: document.category,
    categorySlug: categorySlug(document.category),
    tags: document.tags,
    author: document.author,
    cover: document.cover,
    readingTimeMinutes: document.readingTimeMinutes,
    searchText: normalizeSearchText(searchableFields),
  };
}

function validatedCatalog(documents: readonly ArticleDocument[]): GeneratedContent {
  const index = documents.map(indexEntry);
  const articles = Object.fromEntries(
    documents.map((document) => [`${document.slug}.json`, document]),
  );
  return validateGeneratedContent(index, articles);
}

const representative = validatedCatalog(
  [...representativeDocuments, ...excludedDocuments].filter(
    (document) => document.status === 'published',
  ),
);
const intermediate = validatedCatalog(representativeDocuments.slice(0, 4));
const sparse = validatedCatalog(sparseDocuments);

export function loadReaderAcceptanceContent(scenario: ReaderAcceptanceScenario): GeneratedContent {
  if (scenario === 'representative') return representative;
  if (scenario === 'intermediate') return intermediate;
  if (scenario === 'sparse') return sparse;
  if (scenario === 'ordinary-error') {
    throw new Error('Reader acceptance ordinary error: deterministic route-data failure.');
  }
  throw new Error(`Unknown Reader acceptance scenario: ${String(scenario)}.`);
}
