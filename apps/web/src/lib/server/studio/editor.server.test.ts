import { describe, expect, it } from 'vitest';
import { serializeArticleSource, type ArticleSourceFrontmatter } from '@jelementi/content-compiler';
import type { StudioMetadata } from '../../studio/contracts';
import { FakeGithubAdapter } from './github-adapter.fake';
import {
  decodeStudioFormData,
  isStudioSlugEditable,
  loadNewStudioEditor,
  loadStudioEditor,
  previewStudioArticle,
} from './editor.server';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const metadata: StudioMetadata = {
  title: 'A Draft Article',
  slug: 'a-draft-article',
  excerpt: 'An article being written in Studio.',
  status: 'draft',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover.svg', alt: 'A draft cover' },
  audio: { src: 'articles/a-draft-article/audio.mp3', durationSeconds: 120 },
  references: [
    {
      title: 'Example source',
      url: 'https://example.org/source',
      publisher: 'Example',
      accessedAt: '2026-08-01',
    },
  ],
};

describe('previewStudioArticle', () => {
  it('compiles body-only editor input into a renderer-ready document', () => {
    const result = previewStudioArticle(
      { metadata, body: 'The **body** stays Markdown.' },
      { mediaBaseUrl: 'https://media.jelementi.quz.ma/' },
    );

    expect(result.kind).toBe('preview_ok');
    if (result.kind === 'preview_ok') {
      expect(result.document.slug).toBe(metadata.slug);
      expect(result.document.audio?.durationSeconds).toBe(120);
      expect(result.document.blocks).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'The ' },
            { type: 'text', value: 'body', marks: ['strong'] },
            { type: 'text', value: ' stays Markdown.' },
          ],
        },
      ]);
      expect(result.document.readingTimeMinutes).toBe(1);
    }
  });

  it('returns source-located issues for unsupported Markdown instead of flattening it', () => {
    const result = previewStudioArticle(
      { metadata, body: '# A heading is not supported here' },
      { mediaBaseUrl: 'https://media.jelementi.quz.ma/' },
    );

    expect(result).toMatchObject({
      kind: 'preview_issues',
      compileIssues: [
        {
          code: 'UNSUPPORTED_NODE',
          sourcePath: 'content/articles/a-draft-article.md',
          line: 23,
          column: 1,
        },
      ],
    });
  });
});

describe('loadStudioEditor', () => {
  it('loads an existing canonical source and locks its slug', async () => {
    const adapter = new FakeGithubAdapter(config);
    const sourceFrontmatter: ArticleSourceFrontmatter = {
      ...metadata,
      references: metadata.references,
    };
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.seedFile(
      'main',
      'content/articles/a-draft-article.md',
      serializeArticleSource({ frontmatter: sourceFrontmatter, body: 'Saved body.' }),
      'c'.repeat(64),
    );

    const result = await loadStudioEditor(adapter, 'a-draft-article');

    expect(result).toEqual({
      ok: true,
      value: {
        metadata,
        body: 'Saved body.',
        concurrency: {
          baseMainSha: main.value.sha,
          expectedBlobSha: 'c'.repeat(64),
        },
        slugEditable: false,
      },
    });
  });

  it('keeps an intentionally invalid saved source resumable for correction', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.seedFile(
      'main',
      'content/articles/a-draft-article.md',
      `---\ntitle: Published too soon\nslug: a-draft-article\nstatus: published\n---\n# Unsupported body`,
      'e'.repeat(64),
    );

    const result = await loadStudioEditor(adapter, 'a-draft-article', {
      now: () => '2026-08-20',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata).toMatchObject({
        title: 'Published too soon',
        slug: 'a-draft-article',
        status: 'published',
        updatedAt: '2026-08-20',
      });
      expect(result.value.metadata.publishedAt).toBeUndefined();
      expect(result.value.body).toBe('# Unsupported body');
      expect(result.value.slugEditable).toBe(false);
    }
  });

  it('bounds strict-parser success metadata to Studio display limits', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const overLongTitle = 'A'.repeat(600);
    const manyTags = Array.from({ length: 105 }, (_, index) => `tag-${index}`);
    const sourceFrontmatter: ArticleSourceFrontmatter = {
      ...metadata,
      title: overLongTitle,
      tags: manyTags,
      references: metadata.references,
    };
    adapter.seedFile(
      'main',
      'content/articles/a-draft-article.md',
      serializeArticleSource({ frontmatter: sourceFrontmatter, body: 'Saved body.' }),
      'f'.repeat(64),
    );

    const result = await loadStudioEditor(adapter, 'a-draft-article');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.title).toHaveLength(500);
      expect(result.value.metadata.title).toBe(overLongTitle.slice(0, 500));
      expect(result.value.metadata.tags).toHaveLength(100);
      expect(result.value.metadata.tags).toEqual(manyTags.slice(0, 100));
    }
  });

  it('forces the source-derived slug when recovering an invalid draft with a mismatched slug', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.seedFile(
      'main',
      'content/articles/foo.md',
      `---\ntitle: Mismatched slug draft\nslug: bar\nstatus: published\n---\n# Unsupported body`,
      '1'.repeat(64),
    );

    const result = await loadStudioEditor(adapter, 'foo', { now: () => '2026-08-20' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.slug).toBe('foo');
      expect(result.value.metadata.title).toBe('Mismatched slug draft');
      expect(result.value.slugEditable).toBe(false);
    }
  });

  it('starts a new article with deterministic defaults and no saved identity', async () => {
    const adapter = new FakeGithubAdapter(config);

    const result = await loadNewStudioEditor(adapter, {
      now: () => '2026-08-20',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata).toMatchObject({
        slug: 'new-article',
        status: 'draft',
        updatedAt: '2026-08-20',
      });
      expect(result.value.body).toBe('');
      expect(result.value.slugEditable).toBe(true);
      expect(result.value.concurrency.draftHeadSha).toBeUndefined();
      expect(result.value.concurrency.expectedBlobSha).toBeUndefined();
    }
  });

  it('keeps the new screen blank even if the reserved default slug exists on main', async () => {
    const adapter = new FakeGithubAdapter(config);
    adapter.seedFile(
      'main',
      'content/articles/new-article.md',
      serializeArticleSource({ frontmatter: metadata, body: 'Canonical body.' }),
      'd'.repeat(64),
    );

    const result = await loadNewStudioEditor(adapter);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.title).toBe('Untitled article');
      expect(result.value.body).toBe('');
    }
  });
});

describe('decodeStudioFormData', () => {
  it('reconstructs all metadata fields without accepting raw frontmatter', () => {
    const form = new FormData();
    form.set('title', metadata.title);
    form.set('slug', metadata.slug);
    form.set('excerpt', metadata.excerpt);
    form.set('publishedAt', '');
    form.set('updatedAt', metadata.updatedAt);
    form.set('status', metadata.status);
    form.set('category', metadata.category);
    form.set('tags', metadata.tags.join(', '));
    form.set('author', metadata.author);
    form.set('coverSrc', metadata.cover.src);
    form.set('coverAlt', metadata.cover.alt);
    form.set('audioSrc', metadata.audio?.src ?? '');
    form.set('audioDurationSeconds', String(metadata.audio?.durationSeconds ?? ''));
    for (const reference of metadata.references) {
      form.append('referenceTitle', reference.title);
      form.append('referenceUrl', reference.url);
      form.append('referencePublisher', reference.publisher ?? '');
      form.append('referenceAccessedAt', reference.accessedAt ?? '');
    }
    form.append('referenceTitle', '');
    form.append('referenceUrl', '');
    form.append('referencePublisher', '');
    form.append('referenceAccessedAt', '');
    form.set('body', 'Current body.');
    form.set('baseMainSha', 'a'.repeat(40));

    const result = decodeStudioFormData(form);

    expect(result).toEqual({
      ok: true,
      value: {
        metadata,
        body: 'Current body.',
        concurrency: { baseMainSha: 'a'.repeat(40) },
      },
    });
  });
});

describe('isStudioSlugEditable', () => {
  it('allows a new article slug before the first saved draft', () => {
    expect(isStudioSlugEditable({ baseMainSha: 'a'.repeat(40) })).toBe(true);
  });

  it('locks the slug after a saved draft has a branch head or blob identity', () => {
    expect(
      isStudioSlugEditable({ baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) }),
    ).toBe(false);
    expect(
      isStudioSlugEditable({ baseMainSha: 'a'.repeat(40), expectedBlobSha: 'c'.repeat(64) }),
    ).toBe(false);
  });
});
