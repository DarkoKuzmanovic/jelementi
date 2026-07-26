import { z } from 'zod';

/**
 * Zod schemas for the Phase 0 ArticleDocument contract.
 *
 * The model is intentionally small: it covers the four block types the Phase 0
 * renderer handles (paragraph, heading, image, callout). Inline content is
 * limited to text (with marks) and links.
 *
 * The inline node types are hand-written (not `z.infer`-derived) and the
 * recursive `InlineNodeSchema` is annotated with `z.ZodType<InlineNode>` to
 * break the self-reference introduced by `LinkNode.children: InlineNode[]`.
 * Block and document types are derived from their (non-recursive) schemas via
 * `z.infer`, so the TypeScript view and the runtime validation stay in sync.
 *
 * Framework-specific code does not live here — this package is the neutral
 * contract shared by the compiler (Phase 1), the Svelte renderer and future
 * consumers.
 */

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

export type InlineNode = TextNode | LinkNode;

const TextNodeSchema = z.object({
  type: z.literal('text'),
  value: z.string(),
  marks: z.array(MarkSchema).optional(),
});

export const InlineNodeSchema: z.ZodType<InlineNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema,
    z.object({
      type: z.literal('link'),
      href: z.string(),
      children: z.array(z.lazy(() => InlineNodeSchema)),
    }),
  ]),
);

const HeadingLevelSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);

export const ParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  children: z.array(InlineNodeSchema),
});

export const HeadingBlockSchema = z.object({
  type: z.literal('heading'),
  level: HeadingLevelSchema,
  id: z.string(),
  children: z.array(InlineNodeSchema),
});

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string(),
  alt: z.string(),
  caption: z.array(InlineNodeSchema).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
});

export const CalloutVariantSchema = z.enum(['fact', 'note', 'warning']);

export const CalloutBlockSchema = z.object({
  type: z.literal('callout'),
  variant: CalloutVariantSchema,
  title: z.string().optional(),
  children: z.array(InlineNodeSchema),
});

export const ArticleBlockSchema = z.discriminatedUnion('type', [
  ParagraphBlockSchema,
  HeadingBlockSchema,
  ImageBlockSchema,
  CalloutBlockSchema,
]);

export type ArticleBlock = z.infer<typeof ArticleBlockSchema>;
export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type CalloutVariant = z.infer<typeof CalloutVariantSchema>;

export const ArticleReferenceSchema = z.object({
  title: z.string(),
  url: z.string(),
  publisher: z.string().optional(),
  accessedAt: z.string().optional(),
});

export const ArticleStatusSchema = z.enum(['draft', 'published', 'archived']);

export const ArticleDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    status: ArticleStatusSchema,
    publishedAt: z.string().optional(),
    updatedAt: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    author: z.string(),
    cover: z.object({ src: z.string(), alt: z.string() }),
    audio: z
      .object({
        src: z.string(),
        durationSeconds: z.number().int().min(1).optional(),
      })
      .optional(),
    readingTimeMinutes: z.number().int().min(0),
    blocks: z.array(ArticleBlockSchema),
    references: z.array(ArticleReferenceSchema),
  })
  .refine((doc) => doc.status !== 'published' || doc.publishedAt != null, {
    message: 'publishedAt is required when status is "published"',
    path: ['publishedAt'],
  });

export type ArticleDocument = z.infer<typeof ArticleDocumentSchema>;
export type ArticleReference = z.infer<typeof ArticleReferenceSchema>;
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;
