import type { StudioPreviewInput } from '../server/studio/editor.server';

/** Presentation-only dirty comparison across the complete bounded editor candidate. */
export function studioEditorCandidateEquals(
  left: StudioPreviewInput,
  right: StudioPreviewInput,
): boolean {
  const leftMetadata = left.metadata;
  const rightMetadata = right.metadata;
  return (
    left.body === right.body &&
    leftMetadata.title === rightMetadata.title &&
    leftMetadata.slug === rightMetadata.slug &&
    leftMetadata.excerpt === rightMetadata.excerpt &&
    leftMetadata.status === rightMetadata.status &&
    leftMetadata.publishedAt === rightMetadata.publishedAt &&
    leftMetadata.updatedAt === rightMetadata.updatedAt &&
    leftMetadata.category === rightMetadata.category &&
    stringListEquals(leftMetadata.tags, rightMetadata.tags) &&
    leftMetadata.author === rightMetadata.author &&
    leftMetadata.cover.src === rightMetadata.cover.src &&
    leftMetadata.cover.alt === rightMetadata.cover.alt &&
    leftMetadata.audio?.src === rightMetadata.audio?.src &&
    leftMetadata.audio?.durationSeconds === rightMetadata.audio?.durationSeconds &&
    referencesEqual(leftMetadata.references, rightMetadata.references)
  );
}

function stringListEquals(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function referencesEqual(
  left: StudioPreviewInput['metadata']['references'],
  right: StudioPreviewInput['metadata']['references'],
): boolean {
  return (
    left.length === right.length &&
    left.every((reference, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        reference.title === other.title &&
        reference.url === other.url &&
        reference.publisher === other.publisher &&
        reference.accessedAt === other.accessedAt
      );
    })
  );
}
