import { z } from 'zod';

export const MarkSchema = z.enum(['strong', 'emphasis', 'code', 'strikethrough']);
export type Mark = z.infer<typeof MarkSchema>;

export interface TextNode {
  type: 'text';
  value: string;
  marks?: Mark[];
}

export interface LinkNode {
  type: 'link';
  href: string;
  children: InlineNode[];
}

export interface FootnoteReferenceNode {
  type: 'footnoteReference';
  id: string;
}

export type InlineNode = TextNode | LinkNode | FootnoteReferenceNode;

const NonEmptyStringSchema = z.string().trim().min(1);
const HttpsUrlSchema = z
  .string()
  .url()
  .regex(/^https:\/\//i, {
    message: 'Expected an HTTPS URL',
  });

const IsoDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      // Extract the date portion (YYYY-MM-DD) from either format
      const datePart = value.slice(0, 10);
      // Validate calendar date via round-trip — rejects impossible dates
      // like 2026-02-30 even inside full timestamps.
      const date = new Date(datePart);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) {
        return false;
      }
      // Date-only is fully validated above
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return true;
      }
      // Full ISO timestamp: also verify the complete value parses
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
        return !Number.isNaN(new Date(value).getTime());
      }
      return false;
    },
    { message: 'Expected an ISO date (YYYY-MM-DD) or full ISO timestamp' },
  );

const TextNodeSchema = z
  .object({
    type: z.literal('text'),
    value: z.string(),
    marks: z.array(MarkSchema).optional(),
  })
  .strict()
  .refine((node) => node.marks === undefined || new Set(node.marks).size === node.marks.length, {
    message: 'Text marks must not repeat',
    path: ['marks'],
  });

export const InlineNodeSchema: z.ZodType<InlineNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema,
    z
      .object({
        type: z.literal('link'),
        href: HttpsUrlSchema,
        children: z.array(z.lazy(() => InlineNodeSchema)).min(1),
      })
      .strict(),
    z.object({ type: z.literal('footnoteReference'), id: NonEmptyStringSchema }).strict(),
  ]),
);

const HeadingLevelSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);

export const ParagraphBlockSchema = z
  .object({ type: z.literal('paragraph'), children: z.array(InlineNodeSchema) })
  .strict();

export const HeadingBlockSchema = z
  .object({
    type: z.literal('heading'),
    level: HeadingLevelSchema,
    id: NonEmptyStringSchema,
    children: z.array(InlineNodeSchema).min(1),
  })
  .strict();

export const ImageBlockSchema = z
  .object({
    type: z.literal('image'),
    src: HttpsUrlSchema,
    alt: z.string(),
    caption: z.array(InlineNodeSchema).optional(),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
  })
  .strict();

export const ListBlockSchema = z
  .object({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.array(InlineNodeSchema).min(1)).min(1),
  })
  .strict();

export const QuoteBlockSchema = z
  .object({
    type: z.literal('quote'),
    children: z.array(InlineNodeSchema).min(1),
    attribution: NonEmptyStringSchema.optional(),
  })
  .strict();

export const CalloutVariantSchema = z.enum(['fact', 'note', 'warning']);

export const CalloutBlockSchema = z
  .object({
    type: z.literal('callout'),
    variant: CalloutVariantSchema,
    title: NonEmptyStringSchema.optional(),
    children: z.array(InlineNodeSchema).min(1),
  })
  .strict();

export const DividerBlockSchema = z.object({ type: z.literal('divider') }).strict();

export const ArticleBlockSchema = z.discriminatedUnion('type', [
  ParagraphBlockSchema,
  HeadingBlockSchema,
  ImageBlockSchema,
  ListBlockSchema,
  QuoteBlockSchema,
  CalloutBlockSchema,
  DividerBlockSchema,
]);

export type ArticleBlock = z.infer<typeof ArticleBlockSchema>;
export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type ListBlock = z.infer<typeof ListBlockSchema>;
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type DividerBlock = z.infer<typeof DividerBlockSchema>;
export type CalloutVariant = z.infer<typeof CalloutVariantSchema>;

export const ArticleFootnoteSchema = z
  .object({ id: NonEmptyStringSchema, children: z.array(InlineNodeSchema).min(1) })
  .strict();
export type ArticleFootnote = z.infer<typeof ArticleFootnoteSchema>;

export const ArticleReferenceSchema = z
  .object({
    title: NonEmptyStringSchema,
    url: HttpsUrlSchema,
    publisher: NonEmptyStringSchema.optional(),
    accessedAt: IsoDateSchema.optional(),
  })
  .strict();

export const ArticleStatusSchema = z.enum(['draft', 'published', 'archived']);

function collectFootnoteReferences(nodes: InlineNode[], ids: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'footnoteReference') ids.add(node.id);
    if (node.type === 'link') collectFootnoteReferences(node.children, ids);
  }
}

function referencedFootnoteIds(doc: { blocks: ArticleBlock[] }): Set<string> {
  const ids = new Set<string>();
  for (const block of doc.blocks) {
    if (block.type === 'image' && block.caption) collectFootnoteReferences(block.caption, ids);
    if (block.type === 'divider' || block.type === 'image') continue;
    if (block.type === 'list') {
      for (const item of block.items) collectFootnoteReferences(item, ids);
    } else {
      collectFootnoteReferences(block.children, ids);
    }
  }
  return ids;
}

export const ArticleDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    slug: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    excerpt: NonEmptyStringSchema,
    status: ArticleStatusSchema,
    publishedAt: IsoDateSchema.optional(),
    updatedAt: IsoDateSchema,
    category: NonEmptyStringSchema,
    tags: z.array(NonEmptyStringSchema),
    author: NonEmptyStringSchema,
    cover: z.object({ src: HttpsUrlSchema, alt: z.string() }).strict(),
    audio: z
      .object({ src: HttpsUrlSchema, durationSeconds: z.number().int().min(1).optional() })
      .strict()
      .optional(),
    readingTimeMinutes: z.number().int().min(1),
    blocks: z.array(ArticleBlockSchema),
    footnotes: z.array(ArticleFootnoteSchema),
    references: z.array(ArticleReferenceSchema),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (doc.status === 'published' && doc.publishedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'publishedAt is required when status is "published"',
        path: ['publishedAt'],
      });
    }
    const definitions = new Set<string>();
    for (const [index, footnote] of doc.footnotes.entries()) {
      if (definitions.has(footnote.id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Footnote definitions must be unique',
          path: ['footnotes', index, 'id'],
        });
      }
      definitions.add(footnote.id);
    }
    const references = referencedFootnoteIds(doc);
    for (const id of references) {
      if (!definitions.has(id))
        ctx.addIssue({
          code: 'custom',
          message: 'Footnote reference has no definition',
          path: ['footnotes'],
        });
    }
    for (const [index, footnote] of doc.footnotes.entries()) {
      if (!references.has(footnote.id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Footnote definition is unreferenced',
          path: ['footnotes', index, 'id'],
        });
      }
    }
  });

export type ArticleDocument = z.infer<typeof ArticleDocumentSchema>;
export type ArticleReference = z.infer<typeof ArticleReferenceSchema>;
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;

export const ArticleIndexEntrySchema = z
  .object({
    slug: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    excerpt: NonEmptyStringSchema,
    publishedAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
    category: NonEmptyStringSchema,
    categorySlug: NonEmptyStringSchema,
    tags: z.array(NonEmptyStringSchema),
    author: NonEmptyStringSchema,
    cover: z.object({ src: HttpsUrlSchema, alt: z.string() }).strict(),
    readingTimeMinutes: z.number().int().min(1),
    searchText: NonEmptyStringSchema,
  })
  .strict();
export type ArticleIndexEntry = z.infer<typeof ArticleIndexEntrySchema>;

export const ArticleIndexSchema = z.array(ArticleIndexEntrySchema);
export type ArticleIndex = z.infer<typeof ArticleIndexSchema>;
