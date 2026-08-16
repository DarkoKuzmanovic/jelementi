import { describe, expect, it } from 'vitest';
import {
  ArticleDocumentSchema,
  ArticleIndexSchema,
  articleContentFingerprint,
  canonicalizeJson,
  categorySlug,
  normalizeSearchText,
  validateArticleDocument,
} from '@jelementi/article-model';

const validDocument = {
  schemaVersion: 1,
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  excerpt: "The story of the world's most remote permanent settlement.",
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['remote places', 'islands'],
  author: 'Jelementi',
  cover: { src: 'https://media.example.org/cover.webp', alt: 'The island from above' },
  readingTimeMinutes: 3,
  blocks: [
    {
      type: 'heading',
      level: 2,
      id: 'a-rock-at-the-edge',
      children: [{ type: 'text', value: 'A Rock at the Edge of the World' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'The island has no airport and can only be reached by sea.' },
        { type: 'footnoteReference', id: 'remote-source' },
      ],
    },
    {
      type: 'image',
      src: 'https://media.example.org/map.webp',
      alt: 'Map locating Tristan da Cunha in the South Atlantic',
    },
    {
      type: 'list',
      ordered: false,
      items: [[{ type: 'text', value: 'Flat item', marks: ['strong'] }]],
    },
    {
      type: 'quote',
      children: [{ type: 'text', value: 'The sea defines the island.' }],
      attribution: 'A visitor',
    },
    { type: 'divider' },
    {
      type: 'callout',
      variant: 'fact',
      title: 'No runway, no shortcut',
      children: [{ type: 'text', value: 'The journey from Cape Town takes several days by ship.' }],
    },
  ],
  footnotes: [
    {
      id: 'remote-source',
      children: [
        {
          type: 'link',
          href: 'https://example.org/source',
          children: [{ type: 'text', value: 'Source' }],
        },
      ],
    },
  ],
  references: [
    { title: 'Tristan da Cunha — Government and history', url: 'https://example.org/source' },
  ],
};

describe('ArticleDocument validation', () => {
  it('accepts every locked block and inline node', () => {
    const doc = validateArticleDocument(validDocument);
    expect(doc.blocks).toHaveLength(7);
    expect(doc.footnotes).toHaveLength(1);
  });

  it('rejects a published article without publishedAt', () => {
    const { publishedAt: _publishedAt, ...unpublished } = validDocument;
    expect(() => validateArticleDocument(unpublished)).toThrow();
  });

  it('rejects invalid heading levels and unsupported block discriminants', () => {
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        blocks: [{ type: 'heading', level: 1, id: 'x', children: [] }],
      }).success,
    ).toBe(false);
    expect(
      ArticleDocumentSchema.safeParse({ ...validDocument, blocks: [{ type: 'video', src: 'x' }] })
        .success,
    ).toBe(false);
  });

  it('enforces one matching definition for every footnote reference', () => {
    expect(ArticleDocumentSchema.safeParse({ ...validDocument, footnotes: [] }).success).toBe(
      false,
    );
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        footnotes: [...validDocument.footnotes, validDocument.footnotes[0]],
      }).success,
    ).toBe(false);
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        footnotes: [{ id: 'unused', children: [] }],
      }).success,
    ).toBe(false);
  });
});

describe('Article content fingerprint', () => {
  const document = validateArticleDocument(validDocument);

  it('canonicalizes nested objects with recursively sorted keys and compact JSON', () => {
    expect(canonicalizeJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalizeJson([{ b: 1 }, { a: 2 }])).toBe('[{"b":1},{"a":2}]');
    expect(canonicalizeJson({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });

  it('is independent of object key insertion order but sensitive to array order', () => {
    const left = { b: 1, a: { d: 2, c: 3 } };
    const right = { a: { c: 3, d: 2 }, b: 1 };
    expect(canonicalizeJson(left)).toBe(canonicalizeJson(right));
    expect(canonicalizeJson([1, 2])).not.toBe(canonicalizeJson([2, 1]));
  });

  it('produces a stable lowercase 64-character SHA-256 hex digest', async () => {
    const first = await articleContentFingerprint(document);
    const second = await articleContentFingerprint(document);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it('changes when the document meaningfully changes', async () => {
    const changed = { ...document, title: `${document.title} (revised)` };
    expect(await articleContentFingerprint(changed)).not.toBe(
      await articleContentFingerprint(document),
    );
  });

  it('hashes non-ASCII UTF-8 text deterministically', async () => {
    const unicode = validateArticleDocument({
      ...validDocument,
      title: 'Čačak — 250 people 🏝️',
    });
    const first = await articleContentFingerprint(unicode);
    const second = await articleContentFingerprint(unicode);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });
});

describe('ArticleIndex validation and search normalization', () => {
  const indexEntry = {
    slug: validDocument.slug,
    title: validDocument.title,
    excerpt: validDocument.excerpt,
    publishedAt: validDocument.publishedAt,
    updatedAt: validDocument.updatedAt,
    category: validDocument.category,
    categorySlug: 'history',
    tags: validDocument.tags,
    author: validDocument.author,
    cover: validDocument.cover,
    readingTimeMinutes: validDocument.readingTimeMinutes,
    searchText: 'the 250 people at the end of the world',
  };

  it('accepts published index entries and rejects entries without a publication date', () => {
    expect(ArticleIndexSchema.safeParse([indexEntry]).success).toBe(true);
    const { publishedAt: _publishedAt, ...withoutDate } = indexEntry;
    expect(ArticleIndexSchema.safeParse([withoutDate]).success).toBe(false);
  });

  it('rejects index entries whose categorySlug does not match categorySlug(category)', () => {
    expect(
      ArticleIndexSchema.safeParse([{ ...indexEntry, categorySlug: '../escape' }]).success,
    ).toBe(false);
    expect(ArticleIndexSchema.safeParse([{ ...indexEntry, categorySlug: 'history' }]).success).toBe(
      true,
    );
  });

  it('normalizes case, accents, and whitespace for shared search', () => {
    expect(normalizeSearchText('  Čačak\n  ISLANDS  ')).toBe('cacak islands');
  });

  describe('categorySlug', () => {
    it('normalizes whitespace, case, and diacritics deterministically', () => {
      expect(categorySlug('  Remote Čačak Islands  ')).toBe('remote-cacak-islands');
    });

    it('returns an empty slug when a non-empty name has no usable characters', () => {
      expect(categorySlug('你好')).toBe('');
    });
  });
});

describe('Date validation', () => {
  it('rejects non-ISO date strings for publishedAt and updatedAt', () => {
    expect(
      ArticleDocumentSchema.safeParse({ ...validDocument, publishedAt: 'someday' }).success,
    ).toBe(false);
    expect(
      ArticleDocumentSchema.safeParse({ ...validDocument, updatedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('rejects non-ISO accessedAt in references', () => {
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        references: [
          { title: 'Source', url: 'https://example.org/source', accessedAt: 'tomorrow' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects invalid calendar dates', () => {
    expect(
      ArticleDocumentSchema.safeParse({ ...validDocument, publishedAt: '2026-13-01' }).success,
    ).toBe(false);
    expect(
      ArticleDocumentSchema.safeParse({ ...validDocument, updatedAt: '2026-02-30' }).success,
    ).toBe(false);
  });

  it('accepts date-only and full ISO timestamp values', () => {
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        publishedAt: '2026-07-26T10:30:00Z',
      }).success,
    ).toBe(true);
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        updatedAt: '2026-07-26T10:30:00+02:00',
      }).success,
    ).toBe(true);
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        references: [
          { title: 'Source', url: 'https://example.org/source', accessedAt: '2026-07-26' },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('Locale independence', () => {
  it('normalizeSearchText does not use locale-sensitive toLocaleLowerCase', () => {
    const original = String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase = function () {
      throw new Error('locale-sensitive method called');
    };
    try {
      // 'I' must lowercase to dotted 'i', not locale-dependent dotless 'ı'
      expect(normalizeSearchText('Istanbul ISLANDS')).toBe('istanbul islands');
    } finally {
      String.prototype.toLocaleLowerCase = original;
    }
  });
});

describe('Timestamp calendar validity', () => {
  it('rejects impossible calendar dates in full ISO timestamps', () => {
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        publishedAt: '2026-02-30T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('accepts valid leap-year timestamps with timezone offsets', () => {
    expect(
      ArticleDocumentSchema.safeParse({
        ...validDocument,
        updatedAt: '2024-02-29T12:00:00+02:00',
      }).success,
    ).toBe(true);
  });
});
