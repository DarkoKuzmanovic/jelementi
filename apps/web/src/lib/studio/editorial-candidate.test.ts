import { describe, expect, it } from 'vitest';
import type { StudioPreviewInput } from '../server/studio/editor.server';
import { studioEditorCandidateEquals } from './editorial-candidate';

const first: StudioPreviewInput = {
  metadata: {
    title: 'Article',
    slug: 'article',
    excerpt: 'Excerpt.',
    status: 'published',
    publishedAt: '2026-08-18',
    updatedAt: '2026-08-18',
    category: 'Ideas',
    tags: ['studio', 'writing'],
    author: 'Jelementi',
    cover: { src: 'articles/article/cover-v1.svg', alt: 'Cover.' },
    audio: { src: 'articles/article/audio-v1.mp3', durationSeconds: 90 },
    references: [
      {
        title: 'Source',
        url: 'https://example.com/source',
        publisher: 'Example',
        accessedAt: '2026-08-18',
      },
    ],
  },
  body: 'Body.',
};

const sameValuesDifferentPropertyOrder: StudioPreviewInput = {
  body: 'Body.',
  metadata: {
    references: [
      {
        accessedAt: '2026-08-18',
        publisher: 'Example',
        url: 'https://example.com/source',
        title: 'Source',
      },
    ],
    audio: { durationSeconds: 90, src: 'articles/article/audio-v1.mp3' },
    cover: { alt: 'Cover.', src: 'articles/article/cover-v1.svg' },
    author: 'Jelementi',
    tags: ['studio', 'writing'],
    category: 'Ideas',
    updatedAt: '2026-08-18',
    publishedAt: '2026-08-18',
    status: 'published',
    excerpt: 'Excerpt.',
    slug: 'article',
    title: 'Article',
  },
};

describe('studioEditorCandidateEquals', () => {
  it('compares semantic editor fields without depending on object property order', () => {
    expect(studioEditorCandidateEquals(first, sameValuesDifferentPropertyOrder)).toBe(true);
  });

  it('ignores lifecycle status differences (#111): status is server-derived, never an unsaved operator change', () => {
    expect(
      studioEditorCandidateEquals(first, {
        ...sameValuesDifferentPropertyOrder,
        metadata: {
          ...sameValuesDifferentPropertyOrder.metadata,
          status: 'archived',
        },
      }),
    ).toBe(true);
  });

  it('detects changes across optional audio and reference fields', () => {
    const reference = sameValuesDifferentPropertyOrder.metadata.references[0];
    if (reference === undefined) throw new Error('reference fixture missing');

    expect(
      studioEditorCandidateEquals(first, {
        ...sameValuesDifferentPropertyOrder,
        metadata: {
          ...sameValuesDifferentPropertyOrder.metadata,
          audio: { src: 'articles/article/audio-v2.mp3', durationSeconds: 90 },
        },
      }),
    ).toBe(false);
    expect(
      studioEditorCandidateEquals(first, {
        ...sameValuesDifferentPropertyOrder,
        metadata: {
          ...sameValuesDifferentPropertyOrder.metadata,
          references: [
            {
              ...reference,
              publisher: 'Changed publisher',
            },
          ],
        },
      }),
    ).toBe(false);
  });
});
