/**
 * Client-safe slug identity tracking for the new-article editor (#109).
 *
 * While the writer has not touched the Slug field, it live-tracks the
 * kebab-case of the current Title; the first manual edit freezes the
 * tracking, and clearing the manual edits resumes it. The interfaces are
 * pure so the decisions are unit-testable in Node without a DOM — the
 * component supplies the live control values.
 */

/**
 * The same bound `decodeStudioEditorInput` enforces on submitted slugs;
 * derived values must never exceed it.
 */
export const STUDIO_SLUG_MAX_LENGTH = 100;

/**
 * Kebab-case derivation for a title: lowercase, runs of non-slug
 * characters folded into single hyphens, edge separators stripped, and the
 * result kept within the editor's slug bound. Empty or separator-only
 * titles derive the empty slug — the form's own required/pattern checks
 * then block submission until the writer resolves it.
 */
export function deriveStudioSlug(title: string): string {
  const kebabed = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (kebabed.length <= STUDIO_SLUG_MAX_LENGTH) {
    return kebabed;
  }
  return kebabed.slice(0, STUDIO_SLUG_MAX_LENGTH).replace(/-+$/g, '');
}

/**
 * Whether a manual edit of the Slug control should resume title tracking.
 * Only a fully cleared field resumes (#109 AC); any other value freezes it.
 */
export function resumesTitleTracking(editedSlugValue: string): boolean {
  return editedSlugValue === '';
}

/**
 * The slug the editor should show after a Title edit. Tracking frozen
 * (manually edited slug) yields undefined — the field stays untouched.
 */
export function slugDerivedFromTitle(title: string, tracksTitle: boolean): string | undefined {
  return tracksTitle ? deriveStudioSlug(title) : undefined;
}
