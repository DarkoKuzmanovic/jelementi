import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleDocument } from '@jelementi/article-model';
import ArticleAudio from './ArticleAudio.svelte';
import ArticleRenderer from './ArticleRenderer.svelte';

const document: ArticleDocument = {
  schemaVersion: 1,
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  excerpt: 'A remote settlement.',
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['islands'],
  author: 'Jelementi',
  cover: {
    src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.svg',
    alt: 'Island',
  },
  audio: {
    src: 'https://media.jelementi.quz.ma/articles/tristan-da-cunha/audio-v1.m4a',
    durationSeconds: 12,
  },
  readingTimeMinutes: 1,
  blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Body.' }] }],
  footnotes: [],
  references: [],
};

describe('ArticleAudio', () => {
  it('SSR-renders optional native metadata-only controls with an article-specific fallback link', () => {
    const { body } = render(ArticleAudio, { props: { article: document } });

    expect(body).toContain('<audio');
    expect(body).toContain('controls');
    expect(body).toContain('preload="metadata"');
    expect(body).toContain('aria-label="Audio for The 250 People at the End of the World"');
    expect(body).toContain(
      'href="https://media.jelementi.quz.ma/articles/tristan-da-cunha/audio-v1.m4a"',
    );
    expect(body).not.toContain('autoplay');
    expect(body).not.toContain('preload="auto"');
  });

  it('omits audio markup for an article without audio and composes through the article renderer', () => {
    expect(
      render(ArticleAudio, { props: { article: { ...document, audio: undefined } } }).body,
    ).not.toContain('<audio');
    expect(render(ArticleRenderer, { props: { document } }).body).toContain('<audio');
  });
});
