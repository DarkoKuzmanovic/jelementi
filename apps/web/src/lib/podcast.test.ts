import { describe, expect, it } from 'vitest';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { buildPodcastFeed } from './podcast';

const siteOrigin = 'https://jelementi.quz.ma';

function entry(overrides: Partial<ArticleIndexEntry> & { slug: string }): ArticleIndexEntry {
  return {
    title: overrides.slug,
    excerpt: `${overrides.slug} excerpt.`,
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-05',
    category: 'History',
    categorySlug: 'history',
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://media.jelementi.quz.ma/cover.webp', alt: 'Cover' },
    readingTimeMinutes: 1,
    searchText: overrides.slug,
    ...overrides,
  };
}

function document(overrides: Partial<ArticleDocument> & { slug: string }): ArticleDocument {
  return {
    schemaVersion: 1,
    title: overrides.slug,
    excerpt: `${overrides.slug} excerpt.`,
    status: 'published',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-05',
    category: 'History',
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://media.jelementi.quz.ma/cover.webp', alt: 'Cover' },
    readingTimeMinutes: 1,
    blocks: [],
    footnotes: [],
    references: [],
    ...overrides,
  };
}

const snail = 'the-snail-that-woke-up-in-a-museum';
const kilos = 'twenty-kilos-of-small-change';

function content() {
  return {
    index: [entry({ slug: kilos }), entry({ slug: snail })],
    articles: {
      [kilos]: document({
        slug: kilos,
        title: 'Twenty kilos of small change',
        audio: {
          src: 'https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-midnight-storyteller-2-v1.mp3',
          durationSeconds: 1136,
        },
      }),
      [snail]: document({
        slug: snail,
        title: 'The snail that woke up in a museum',
        audio: {
          src: 'https://media.jelementi.quz.ma/articles/the-snail-that-woke-up-in-a-museum/narration-heart-approved-v3.mp3',
          durationSeconds: 719,
        },
      }),
    },
  };
}

const byteLengths = {
  'https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-midnight-storyteller-2-v1.mp3': 22724809,
  'https://media.jelementi.quz.ma/articles/the-snail-that-woke-up-in-a-museum/narration-heart-approved-v3.mp3': 11506266,
};

describe('buildPodcastFeed', () => {
  it('emits one enclosure item per published article with audio and a verified length', () => {
    const feed = buildPodcastFeed(content(), { siteOrigin, byteLengths });

    expect(feed).toContain(
      '<enclosure url="https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-midnight-storyteller-2-v1.mp3" length="22724809" type="audio/mpeg" />',
    );
    expect(feed).toContain(
      '<enclosure url="https://media.jelementi.quz.ma/articles/the-snail-that-woke-up-in-a-museum/narration-heart-approved-v3.mp3" length="11506266" type="audio/mpeg" />',
    );
    expect(feed.match(/<item>/g)).toHaveLength(2);
  });

  it('excludes articles without audio instead of faking length=0', () => {
    const base = content();
    const silent = 'silent-article';
    const feed = buildPodcastFeed(
      {
        index: [entry({ slug: silent }), ...base.index],
        articles: { ...base.articles, [silent]: document({ slug: silent }) },
      },
      { siteOrigin, byteLengths },
    );

    expect(feed).not.toContain(silent);
    expect(feed).not.toContain('length="0"');
    expect(feed.match(/<item>/g)).toHaveLength(2);
  });

  it('throws for published audio lacking a generated length instead of silently omitting it', () => {
    const base = content();
    const unverified = 'unverified-article';

    expect(() =>
      buildPodcastFeed(
        {
          index: [entry({ slug: unverified }), ...base.index],
          articles: {
            ...base.articles,
            [unverified]: document({
              slug: unverified,
              audio: { src: 'https://media.jelementi.quz.ma/articles/unverified/audio.mp3' },
            }),
          },
        },
        { siteOrigin, byteLengths },
      ),
    ).toThrow(/unverified-article/);
  });

  it('keeps a stable article-identity GUID when the audio file is replaced', () => {
    const base = content();
    const replaced = {
      ...base.articles[kilos],
      audio: {
        src: 'https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-v2.mp3',
        durationSeconds: 1136,
      },
    };
    const before = buildPodcastFeed(base, { siteOrigin, byteLengths });
    const after = buildPodcastFeed(
      { index: base.index, articles: { ...base.articles, [kilos]: replaced } },
      {
        siteOrigin,
        byteLengths: {
          ...byteLengths,
          'https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-v2.mp3': 22724809,
        },
      },
    );

    const guid = `<guid isPermaLink="true">${siteOrigin}/articles/${kilos}</guid>`;
    expect(before).toContain(guid);
    expect(after).toContain(guid);
    expect(after).not.toContain('narration-midnight-storyteller-2-v1.mp3');
  });

  it('escapes XML text and orders items newest-first with RFC-822 dates', () => {
    const feed = buildPodcastFeed(
      {
        index: [entry({ slug: kilos }), entry({ slug: snail, publishedAt: '2026-07-26' })],
        articles: {
          ...content().articles,
          [kilos]: document({
            slug: kilos,
            title: 'Twenty & <kilos> "quoted"',
            excerpt: "Small 'change' & more",
            audio: {
              src: 'https://media.jelementi.quz.ma/articles/twenty-kilos-of-small-change/narration-midnight-storyteller-2-v1.mp3',
              durationSeconds: 1136,
            },
          }),
        },
      },
      { siteOrigin, byteLengths },
    );

    expect(feed).toContain('Twenty &amp; &lt;kilos&gt; &quot;quoted&quot;');
    expect(feed).toContain('Small &apos;change&apos; &amp; more');
    expect(feed.indexOf('twenty-kilos-of-small-change')).toBeLessThan(feed.indexOf(snail));
    expect(feed).toContain('<pubDate>Mon, 05 Oct 2026 00:00:00 GMT</pubDate>');
    expect(feed).toContain('<itunes:duration>1136</itunes:duration>');
  });

  it('keys enclosures by the exact compiled audio URL, so a nonroot media base matches', () => {
    const src = 'https://media.example.org/subpath/articles/remote/audio-v1.m4a?download=1&raw=1';
    const feed = buildPodcastFeed(
      {
        index: [entry({ slug: kilos })],
        articles: {
          [kilos]: document({
            slug: kilos,
            audio: { src, durationSeconds: 42 },
          }),
        },
      },
      { siteOrigin, byteLengths: { [src]: 999 } },
    );

    expect(feed).toContain(
      '<enclosure url="https://media.example.org/subpath/articles/remote/audio-v1.m4a?download=1&amp;raw=1" length="999" type="audio/mp4" />',
    );
  });
});
