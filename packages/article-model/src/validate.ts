import { ArticleDocumentSchema } from './schema';
import type { ArticleDocument } from './schema';

/**
 * Parse and validate an unknown value as an {@link ArticleDocument}.
 * Throws a Zod error when the input violates the schema.
 */
export function validateArticleDocument(input: unknown): ArticleDocument {
  return ArticleDocumentSchema.parse(input);
}

/**
 * Non-throwing variant of {@link validateArticleDocument}.
 */
export function safeValidateArticleDocument(
  input: unknown,
): { success: true; data: ArticleDocument } | { success: false; error: unknown } {
  const result = ArticleDocumentSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
