import { describe, expect, it } from 'vitest';
import { serializeArticleSource, type ArticleSourceFrontmatter } from '@jelementi/content-compiler';
import type { StudioMetadata } from '../../studio/contracts';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { GithubAdapterResult, StudioPullRequest } from './github-adapter';
import {
  decodeStudioFormData,
  isStudioSlugEditable,
  loadNewStudioEditor,
  loadStudioEditor,
  previewStudioArticle,
  saveStudioDraft,
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

describe('saveStudioDraft', () => {
  const previewOptions = { mediaBaseUrl: 'https://media.jelementi.quz.ma/' };
  const slug = metadata.slug;

  it('discovers no existing branch, creates one from the observed main SHA, commits, and opens a Draft PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Saved body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') return;
    expect(result.concurrency.baseMainSha).toBe(main.value.sha);
    expect(result.concurrency.draftHeadSha).toBeDefined();
    expect(result.concurrency.expectedBlobSha).toBeDefined();
    expect(result.compileIssues).toEqual([]);
    expect(result.pullRequest.number).toBeGreaterThan(0);

    const branches = await adapter.listStudioBranches();
    expect(branches).toEqual({
      ok: true,
      value: [
        {
          name: `studio/article/${slug}`,
          sha: result.concurrency.draftHeadSha,
          url: expect.any(String),
        },
      ],
    });
    const pulls = await adapter.listPullRequests(`studio/article/${slug}`);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: result.pullRequest.number, draft: true, state: 'open' }),
    ]);
    const committed = await adapter.getFileContent(
      `studio/article/${slug}`,
      `content/articles/${slug}.md`,
    );
    expect(committed.ok && committed.value.content).toContain('Saved body.');
  });

  it('continues an existing draft branch, commits against its current head, and reuses the open Draft PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'First body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );
    if (first.kind !== 'saved') throw new Error('first save failed');

    const second = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Second body.', concurrency: first.concurrency },
      previewOptions,
    );

    expect(second.kind).toBe('saved');
    if (second.kind !== 'saved') return;
    expect(second.pullRequest.number).toBe(first.pullRequest.number);
    expect(second.concurrency.draftHeadSha).not.toBe(first.concurrency.draftHeadSha);

    const pulls = await adapter.listPullRequests(`studio/article/${slug}`);
    expect(pulls.ok && pulls.value).toHaveLength(1);
    const committed = await adapter.getFileContent(
      `studio/article/${slug}`,
      `content/articles/${slug}.md`,
    );
    expect(committed.ok && committed.value.content).toContain('Second body.');
  });

  it('retries onto an orphan branch (created, never committed) without creating a duplicate branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    // Simulates an interrupted earlier Save: the branch was created from the
    // observed main SHA but the file commit never landed (#15/#16 recovery
    // topology). The client still only holds the original, branch-less
    // concurrency evidence (draftHeadSha undefined).
    adapter.seedBranch(`studio/article/${slug}`, main.value.sha);

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Recovered body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(result.kind).toBe('saved');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value).toHaveLength(1);
  });

  it('resumes the exact load-time recovery evidence into a successful save without duplicating the branch', async () => {
    // Threads loadStudioEditor's orphan-branch recovery state (an active
    // branch, no committed file, draftHeadSha set to the branch head)
    // straight into saveStudioDraft, mirroring the operator flow: reload the
    // interrupted draft, then Save again from exactly what was loaded.
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.seedBranch(`studio/article/${slug}`, main.value.sha);

    const loaded = await loadStudioEditor(adapter, slug);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.body).toBe('');
    expect(loaded.value.slugEditable).toBe(false);
    expect(loaded.value.concurrency).toEqual({
      baseMainSha: main.value.sha,
      draftHeadSha: main.value.sha,
    });

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Resumed from recovery.', concurrency: loaded.value.concurrency },
      previewOptions,
    );

    expect(result.kind).toBe('saved');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value).toHaveLength(1);
  });

  it('does not duplicate a branch or PR on retry after a full prior save with stale client evidence', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const originalConcurrency = { baseMainSha: main.value.sha };

    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'First body.', concurrency: originalConcurrency },
      previewOptions,
    );
    expect(first.kind).toBe('saved');

    // A client retrying with the same original (now stale) evidence, e.g.
    // because the first response was lost, must never create a second branch
    // or a second PR — it fails closed as a conflict instead.
    const retry = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Retried body.', concurrency: originalConcurrency },
      previewOptions,
    );

    expect(retry.kind).toBe('save_conflict');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value).toHaveLength(1);
    const pulls = await adapter.listPullRequests(`studio/article/${slug}`);
    expect(pulls.ok && pulls.value).toHaveLength(1);
  });

  it('fails closed with a comparison when main has moved before any draft branch exists', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const staleBaseMainSha = 'f'.repeat(40);

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: staleBaseMainSha } },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: { baseMainSha: staleBaseMainSha },
      current: { baseMainSha: main.value.sha },
    });
    const branches = await adapter.listStudioBranches();
    expect(branches).toEqual({ ok: true, value: [] });
  });

  it('fails closed on unexpected topology when an existing branch has already moved beyond main', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const other = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Someone else’s save.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );
    if (other.kind !== 'saved') throw new Error('setup save failed');

    // A caller that never saw the branch (still holds the original,
    // branch-less evidence) must not be allowed to commit on top of it.
    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Unaware save.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: { baseMainSha: main.value.sha },
      current: { baseMainSha: main.value.sha, draftHeadSha: other.concurrency.draftHeadSha },
    });
  });

  it('fails closed when the expected draft head no longer matches the branch', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'First body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );
    if (first.kind !== 'saved') throw new Error('setup save failed');

    const staleDraftHeadSha = main.value.sha;
    const result = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Stale edit.',
        concurrency: { baseMainSha: main.value.sha, draftHeadSha: staleDraftHeadSha },
      },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: { baseMainSha: main.value.sha, draftHeadSha: staleDraftHeadSha },
      current: { baseMainSha: main.value.sha, draftHeadSha: first.concurrency.draftHeadSha },
    });
  });

  it('fails closed when the draft branch has disappeared', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Body.',
        concurrency: { baseMainSha: main.value.sha, draftHeadSha: 'b'.repeat(40) },
      },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: { baseMainSha: main.value.sha, draftHeadSha: 'b'.repeat(40) },
      current: { baseMainSha: main.value.sha },
    });
  });

  it('saves an invalid draft and surfaces structured compile issues instead of blocking the write', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const result = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: '# A heading is not supported here',
        concurrency: { baseMainSha: main.value.sha },
      },
      previewOptions,
    );

    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') return;
    expect(result.compileIssues).toMatchObject([{ code: 'UNSUPPORTED_NODE' }]);
    const committed = await adapter.getFileContent(
      `studio/article/${slug}`,
      `content/articles/${slug}.md`,
    );
    expect(committed.ok && committed.value.content).toContain('# A heading is not supported here');
  });

  it('offers Draft replacement only when unrelated main movement passes every proof', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.seedFile(
      'main',
      `content/articles/${slug}.md`,
      serializeArticleSource({ frontmatter: metadata, body: 'Canonical body.' }),
      'b'.repeat(40),
    );
    const first = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'Original draft.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      previewOptions,
    );
    if (first.kind !== 'saved') throw new Error('first save failed');
    const freshMainSha = adapter.advanceMain();

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Preserved candidate.', concurrency: first.concurrency },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: first.concurrency,
      current: { baseMainSha: freshMainSha, draftHeadSha: first.concurrency.draftHeadSha },
      replacementAvailable: true,
    });
  });

  it('blocks a save onto an existing draft when the loaded main SHA is stale', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'First body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );
    if (first.kind !== 'saved') throw new Error('first save failed');

    // The operator's evidence still claims the original main SHA, but the
    // draft branch head matches (as if only main moved on since it was
    // loaded, e.g. between two edit sessions of the same draft).
    const staleConcurrency = { ...first.concurrency, baseMainSha: 'c'.repeat(40) };

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Second body.', concurrency: staleConcurrency },
      previewOptions,
    );

    expect(result).toEqual({
      kind: 'save_conflict',
      loaded: staleConcurrency,
      current: { baseMainSha: main.value.sha, draftHeadSha: first.concurrency.draftHeadSha },
    });
    const pulls = await adapter.listPullRequests(`studio/article/${slug}`);
    expect(pulls.ok && pulls.value).toHaveLength(1);
  });

  it('fails closed before any write when more than one open PR already exists', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branchName = `studio/article/${slug}`;
    adapter.seedBranch(branchName, main.value.sha);
    adapter.seedPullRequest(branchName, { draft: true });
    adapter.seedPullRequest(branchName, { draft: true });

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(result).toEqual({ kind: 'save_failed', phase: 'pull-request', reason: 'topology' });
    // Discovered and rejected before any commit — the branch is untouched
    // (still at main's SHA, no article file) and neither open PR changed.
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value).toEqual([
      { name: branchName, sha: main.value.sha, url: expect.any(String) },
    ]);
    const committed = await adapter.getFileContent(branchName, `content/articles/${slug}.md`);
    expect(committed.ok).toBe(false);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(2);
  });

  it('fails closed before any write when the sole open PR is no longer a Draft PR', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const branchName = `studio/article/${slug}`;
    adapter.seedBranch(branchName, main.value.sha);
    const readyPull = adapter.seedPullRequest(branchName, { draft: false });

    const result = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(result).toEqual({ kind: 'save_failed', phase: 'pull-request', reason: 'topology' });
    const committed = await adapter.getFileContent(branchName, `content/articles/${slug}.md`);
    expect(committed.ok).toBe(false);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toEqual([
      expect.objectContaining({ number: readyPull.number }),
    ]);
  });

  it('retries an unreachable PR-topology discovery without ever committing (no duplicate commit)', async () => {
    class FlakyGithubAdapter extends FakeGithubAdapter {
      failNextListPullRequests = false;
      async listPullRequests(head: string): Promise<GithubAdapterResult<StudioPullRequest[]>> {
        if (this.failNextListPullRequests) {
          this.failNextListPullRequests = false;
          return { ok: false, failure: { operation: 'list-pull-requests', reason: 'transport' } };
        }
        return super.listPullRequests(head);
      }
    }
    const adapter = new FlakyGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.failNextListPullRequests = true;

    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    // PR-topology discovery now runs before any commit, so this failure
    // carries no commit evidence to preserve — nothing was written yet.
    expect(first).toEqual({ kind: 'save_failed', phase: 'pull-request', reason: 'github' });
    const branchName = `studio/article/${slug}`;
    const committedBeforeRetry = await adapter.getFileContent(
      branchName,
      `content/articles/${slug}.md`,
    );
    expect(committedBeforeRetry.ok).toBe(false);

    // A natural retry resubmits the operator's original (still branch-less)
    // evidence; the branch created before the failed PR check is exactly the
    // "created, not yet committed" recoverable topology, so it is reused.
    const retry = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    expect(retry.kind).toBe('saved');
    const branchesAfterRetry = await adapter.listStudioBranches();
    expect(branchesAfterRetry.ok && branchesAfterRetry.value).toHaveLength(1);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(1);
  });

  it('preserves the completed commit as retry evidence when opening a new pull request fails, reusing the same commit on retry', async () => {
    class FlakyGithubAdapter extends FakeGithubAdapter {
      failNextCreatePullRequest = false;
      async createPullRequest(
        input: Parameters<FakeGithubAdapter['createPullRequest']>[0],
      ): Promise<GithubAdapterResult<StudioPullRequest>> {
        if (this.failNextCreatePullRequest) {
          this.failNextCreatePullRequest = false;
          return { ok: false, failure: { operation: 'create-pull-request', reason: 'transport' } };
        }
        return super.createPullRequest(input);
      }
    }
    const adapter = new FlakyGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    adapter.failNextCreatePullRequest = true;

    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: { baseMainSha: main.value.sha } },
      previewOptions,
    );

    // The commit already landed by the time PR creation is attempted, so this
    // failure preserves that commit's evidence for the retry to resume from.
    expect(first).toMatchObject({ kind: 'save_failed', phase: 'pull-request', reason: 'github' });
    if (first.kind !== 'save_failed' || first.concurrency === undefined) {
      throw new Error('expected recoverable concurrency evidence');
    }
    const branchName = `studio/article/${slug}`;
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value).toHaveLength(1);
    expect(branches.ok && branches.value[0]?.sha).toBe(first.concurrency.draftHeadSha);

    const retry = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Body.', concurrency: first.concurrency },
      previewOptions,
    );

    expect(retry.kind).toBe('saved');
    const branchesAfterRetry = await adapter.listStudioBranches();
    expect(branchesAfterRetry.ok && branchesAfterRetry.value).toHaveLength(1);
    const pulls = await adapter.listPullRequests(branchName);
    expect(pulls.ok && pulls.value).toHaveLength(1);
  });
});
