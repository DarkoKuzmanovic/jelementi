import { describe, it, expect } from 'vitest';
import {
  validateArticleDocument,
  ArticleDocumentSchema,
  sampleArticle,
} from '@jelementi/article-model';
import type { ArticleDocument } from '@jelementi/article-model';

// A complete, hand-written valid document exercising every Phase 0 block type.
const validDocument: ArticleDocument = {
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
      ],
    },
    {
      type: 'image',
      src: 'https://media.example.org/map.webp',
      alt: 'Map locating Tristan da Cunha in the South Atlantic',
    },
    {
      type: 'callout',
      variant: 'fact',
      title: 'No runway, no shortcut',
      children: [{ type: 'text', value: 'The journey from Cape Town takes several days by ship.' }],
    },
  ],
  references: [
    { title: 'Tristan da Cunha — Government and history', url: 'https://example.org/source' },
  ],
};

describe('ArticleDocument validation', () => {
  it('accepts a complete valid document', () => {
    const doc = validateArticleDocument(validDocument) as ArticleDocument;
    expect(doc.slug).toBe('tristan-da-cunha');
    expect(doc.schemaVersion).toBe(1);
  });

  it('accepts the shared sample fixture', () => {
    const doc = validateArticleDocument(sampleArticle) as ArticleDocument;
    expect(doc.slug).toBe('tristan-da-cunha');
    expect((doc.blocks as unknown[]).length).toBeGreaterThan(0);
  });

  it('rejects a document missing required "blocks"', () => {
    const rest = { ...validDocument } as Record<string, unknown>;
    delete rest.blocks;
    expect(() => validateArticleDocument(rest)).toThrow();
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(() => validateArticleDocument({ ...validDocument, schemaVersion: 99 })).toThrow();
  });

  it('rejects a published article without publishedAt', () => {
    const rest = { ...validDocument } as Record<string, unknown>;
    delete rest.publishedAt;
    expect(() => validateArticleDocument(rest)).toThrow();
  });

  it('rejects an unknown block type (exhaustive discriminant)', () => {
    const doc = { ...validDocument, blocks: [{ type: 'video', src: 'x' }] };
    expect(() => validateArticleDocument(doc)).toThrow();
  });

  it('rejects a callout with an invalid variant', () => {
    const blocks = [{ type: 'callout', variant: 'danger', children: [] }];
    expect(() => validateArticleDocument({ ...validDocument, blocks })).toThrow();
  });

  it('rejects a heading with an invalid level', () => {
    const blocks = [{ type: 'heading', level: 5, id: 'x', children: [] }];
    expect(() => validateArticleDocument({ ...validDocument, blocks })).toThrow();
  });

  it('safeParse returns success=false on invalid input', () => {
    const result = ArticleDocumentSchema.safeParse({ wrong: true });
    expect(result.success).toBe(false);
  });
});
