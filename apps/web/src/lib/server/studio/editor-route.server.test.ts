import { describe, expect, it, vi } from 'vitest';
import { serializeArticleSource } from '@jelementi/content-compiler';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { StudioGithubConfig } from './config.server';
import { decodeStudioActionEnvelope } from '../../studio/action-envelope';
import {
  loadStudioEditorPage,
  previewStudioEditorAction,
  replaceStudioEditorAction,
  saveStudioEditorAction,
} from './editor-route.server';

const { requireStudioAccess, requireStudioMutation } = vi.hoisted(() => ({
  requireStudioAccess: vi.fn(async () => ({ ok: true as const, email: 'darko@example.com' })),
  requireStudioMutation: vi.fn(async () => ({ ok: true as const, email: 'darko@example.com' })),
}));

vi.mock('./request-guard.server', () => ({ requireStudioAccess, requireStudioMutation }));

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const env: WorkerEnv = {
  ACCESS_TEAM_DOMAIN: 'https://jelementi.cloudflareaccess.com',
  ACCESS_AUD: 'studio-audience',
  ALLOWED_OPERATOR_EMAIL: 'darko@example.com',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_CLIENT_ID: 'Iv1.client',
  GITHUB_INSTALLATION_ID: '654321',
  GITHUB_REPO_OWNER: 'DarkoKuzmanovic',
  GITHUB_REPO_NAME: 'jelementi',
  PRODUCTION_ORIGIN: 'https://jelementi.quz.ma',
  PUBLIC_MEDIA_BASE_URL: 'https://media.jelementi.quz.ma/',
  GITHUB_APP_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
  R2_MEDIA: undefined,
};

const adapter = new FakeGithubAdapter(config);
adapter.seedFile(
  'main',
  'content/articles/tristan-da-cunha.md',
  serializeArticleSource({
    frontmatter: {
      title: 'The 250 People at the End of the World',
      slug: 'tristan-da-cunha',
      excerpt: 'A remote settlement.',
      publishedAt: '2026-07-26',
      updatedAt: '2026-07-26',
      status: 'published',
      category: 'History',
      tags: ['islands'],
      author: 'Jelementi',
      cover: { src: 'articles/tristan-da-cunha/cover.svg', alt: 'Island' },
      references: [],
    },
    body: 'Body.',
  }),
  'b'.repeat(64),
);

function event(request: Request = new Request('https://jelementi.quz.ma/studio')) {
  return { request, platform: { env }, locals: { studioGithubAdapter: adapter } };
}

function validForm(): FormData {
  const form = new FormData();
  form.set('title', 'A draft');
  form.set('slug', 'a-draft');
  form.set('excerpt', 'An excerpt.');
  form.set('publishedAt', '');
  form.set('updatedAt', '2026-08-20');
  form.set('status', 'draft');
  form.set('category', 'Ideas');
  form.set('tags', 'studio, writing');
  form.set('author', 'Jelementi');
  form.set('coverSrc', 'articles/a-draft/cover.svg');
  form.set('coverAlt', 'Cover');
  form.set('audioSrc', '');
  form.set('audioDurationSeconds', '');
  form.append('referenceTitle', '');
  form.append('referenceUrl', '');
  form.append('referencePublisher', '');
  form.append('referenceAccessedAt', '');
  form.set('body', 'The **body**.');
  form.set('baseMainSha', 'a'.repeat(40));
  return form;
}

describe('Studio editor route boundary', () => {
  it('loads an existing editor only after authorization', async () => {
    const result = await loadStudioEditorPage(event(), 'tristan-da-cunha');

    expect(requireStudioAccess).toHaveBeenCalled();
    expect(result.editor.metadata.slug).toBe('tristan-da-cunha');
    expect(result.editor.body).toBe('Body.');
  });

  it('previews through the shared correlated envelope without a GitHub write', async () => {
    const form = validForm();
    form.set('enhancementOperationId', 'preview-op');
    form.set('submittedSnapshotId', 'preview-snapshot');
    const result = await previewStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/a-draft?/preview', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(requireStudioMutation).toHaveBeenCalled();
    expect(result.preview.kind).toBe('preview_ok');
    expect(result.editor?.body).toBe('The **body**.');
    const envelope = decodeStudioActionEnvelope(result.envelope);
    expect(envelope).toMatchObject({
      ok: true,
      value: {
        kind: 'preview',
        operationId: 'preview-op',
        submittedSnapshotId: 'preview-snapshot',
      },
    });
    const branches = await adapter.listStudioBranches();
    expect(branches).toEqual({ ok: true, value: [] });
  });

  it('returns a safe source location based on a valid submitted slug for invalid forms', async () => {
    const form = validForm();
    form.set('slug', 'draft-notes');
    form.set('baseMainSha', 'not-a-sha');

    const result = await previewStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/draft-notes?/preview', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(result.preview).toMatchObject({
      kind: 'preview_issues',
      compileIssues: [
        { code: 'INVALID_EDITOR_INPUT', sourcePath: 'content/articles/draft-notes.md' },
      ],
    });
    expect(result.editor?.metadata.title).toBe('A draft');
    expect(result.editor?.body).toBe('The **body**.');
  });

  it('does not reflect over-limit body input beyond the display bound', async () => {
    const form = validForm();
    form.set('body', 'x'.repeat(2_000_001));

    const result = await previewStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/new?/preview', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(result.preview.kind).toBe('preview_issues');
    expect(result.editor?.body).toHaveLength(2_000_000);
  });

  it('rejects a tampered slug on an established article at the server boundary', async () => {
    const form = validForm();
    form.set('slug', 'different-slug');

    const result = await previewStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/tristan-da-cunha?/preview', {
          method: 'POST',
          body: form,
        }),
      ),
      'tristan-da-cunha',
    );

    expect(result.preview).toMatchObject({
      kind: 'preview_issues',
      compileIssues: [
        {
          code: 'SLUG_IMMUTABLE',
          sourcePath: 'content/articles/tristan-da-cunha.md',
        },
      ],
    });
    expect(result.editor?.metadata.slug).toBe('tristan-da-cunha');
  });
});

describe('Studio save route boundary', () => {
  it('commits a new draft and returns its server-authored identity and workspace envelope', async () => {
    const form = validForm();
    form.set('slug', 'a-fresh-save');
    form.set('enhancementOperationId', 'save-op');
    form.set('submittedSnapshotId', 'save-snapshot');
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('expected main ref');
    form.set('baseMainSha', main.value.sha);

    const result = await saveStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/new?/save', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(requireStudioMutation).toHaveBeenCalled();
    expect(result.save.kind).toBe('saved');
    if (result.save.kind !== 'saved') throw new Error('expected saved');
    expect(result.save.pullRequest.number).toBeGreaterThan(0);
    expect(result.save.concurrency.draftHeadSha).toBeDefined();
    expect(result.editor?.metadata.slug).toBe('a-fresh-save');
    expect(result.acceptedSlug).toBe('a-fresh-save');
    const envelope = decodeStudioActionEnvelope(result.envelope);
    expect(envelope).toMatchObject({
      ok: true,
      value: {
        kind: 'save',
        operationId: 'save-op',
        submittedSnapshotId: 'save-snapshot',
        workspace: { slug: 'a-fresh-save', concurrency: result.save.concurrency },
      },
    });

    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value.map((b) => b.name)).toContain(
      'studio/article/a-fresh-save',
    );
  });

  it('returns the actionable validation projection inside an enhanced invalid-Save envelope', async () => {
    const form = validForm();
    form.set('slug', 'invalid-enhanced-save');
    form.set('body', '# Unsupported heading');
    form.set('enhancementOperationId', 'invalid-save-op');
    form.set('submittedSnapshotId', 'invalid-save-snapshot');
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('expected main ref');
    form.set('baseMainSha', main.value.sha);

    const result = await saveStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/new?/save', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(result.validation).toMatchObject({ count: 1, severity: 'blocking' });
    expect(decodeStudioActionEnvelope(result.envelope)).toMatchObject({
      ok: true,
      value: {
        kind: 'save',
        validation: { count: 1, severity: 'blocking' },
      },
    });
  });

  it('rejects an invalid form without touching GitHub', async () => {
    const form = validForm();
    form.set('slug', 'bad-save');
    form.set('baseMainSha', 'not-a-sha');

    const result = await saveStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/new?/save', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(result.save).toMatchObject({
      kind: 'save_rejected',
      compileIssues: [{ code: 'INVALID_EDITOR_INPUT', sourcePath: 'content/articles/bad-save.md' }],
    });
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value.map((b) => b.name)).not.toContain(
      'studio/article/bad-save',
    );
  });

  it('rejects a tampered slug on an established article before any GitHub write', async () => {
    const form = validForm();
    form.set('slug', 'different-slug');

    const result = await saveStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/tristan-da-cunha?/save', {
          method: 'POST',
          body: form,
        }),
      ),
      'tristan-da-cunha',
    );

    expect(result.save).toMatchObject({
      kind: 'save_rejected',
      compileIssues: [
        { code: 'SLUG_IMMUTABLE', sourcePath: 'content/articles/tristan-da-cunha.md' },
      ],
    });
    expect(result.editor?.metadata.slug).toBe('tristan-da-cunha');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value.map((b) => b.name)).not.toContain(
      'studio/article/different-slug',
    );
  });

  it('fails closed as a save conflict when the loaded main SHA is stale', async () => {
    const form = validForm();
    form.set('slug', 'stale-main-save');
    form.set('baseMainSha', 'c'.repeat(40));

    const result = await saveStudioEditorAction(
      event(
        new Request('https://jelementi.quz.ma/studio/articles/new?/save', {
          method: 'POST',
          body: form,
        }),
      ),
    );

    expect(result.save.kind).toBe('save_conflict');
    const branches = await adapter.listStudioBranches();
    expect(branches.ok && branches.value.map((b) => b.name)).not.toContain(
      'studio/article/stale-main-save',
    );
  });

  it('reports 503 when no GitHub adapter is wired', async () => {
    const form = validForm();
    const request = new Request('https://jelementi.quz.ma/studio/articles/new?/save', {
      method: 'POST',
      body: form,
    });

    await expect(
      saveStudioEditorAction({ request, platform: { env }, locals: {} }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('Studio Draft replacement route boundary', () => {
  it('authorizes, decodes, replaces, and preserves the submitted candidate', async () => {
    requireStudioMutation.mockClear();
    const replacementAdapter = new FakeGithubAdapter(config);
    const main = await replacementAdapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const firstForm = validForm();
    firstForm.set('baseMainSha', main.value.sha);
    const saved = await saveStudioEditorAction(
      {
        request: new Request('https://jelementi.quz.ma/studio/articles/a-draft?/save', {
          method: 'POST',
          body: firstForm,
        }),
        platform: { env },
        locals: { studioGithubAdapter: replacementAdapter },
      },
      'a-draft',
    );
    if (saved.save.kind !== 'saved') throw new Error(`save failed: ${saved.save.kind}`);
    replacementAdapter.advanceMain();

    const replacementForm = validForm();
    replacementForm.set('body', 'Candidate preserved by the route.');
    replacementForm.set('baseMainSha', saved.save.concurrency.baseMainSha);
    replacementForm.set('draftHeadSha', saved.save.concurrency.draftHeadSha as string);
    replacementForm.set('expectedBlobSha', saved.save.concurrency.expectedBlobSha as string);
    const result = await replaceStudioEditorAction(
      {
        request: new Request('https://jelementi.quz.ma/studio/articles/a-draft?/replace', {
          method: 'POST',
          body: replacementForm,
        }),
        platform: { env },
        locals: { studioGithubAdapter: replacementAdapter },
      },
      'a-draft',
    );

    expect(requireStudioMutation).toHaveBeenCalled();
    expect(result.replacement).toMatchObject({
      kind: 'replaced',
      candidate: { body: 'Candidate preserved by the route.' },
    });
    expect(result.editor?.body).toBe('Candidate preserved by the route.');
    expect(result.status).toMatchObject({
      kind: 'draft_valid',
      article: { slug: 'a-draft' },
      branch: {
        headSha:
          result.replacement.kind === 'replaced'
            ? result.replacement.concurrency.draftHeadSha
            : undefined,
      },
    });
  });

  it('guards first and rejects a tampered slug without calling GitHub or losing the candidate', async () => {
    requireStudioMutation.mockClear();
    const replacementAdapter = new FakeGithubAdapter(config);
    const getMainRef = vi.spyOn(replacementAdapter, 'getMainRef');
    const form = validForm();
    form.set('slug', 'different-article');
    form.set('body', 'Keep this tampered submission visible.');

    const result = await replaceStudioEditorAction(
      {
        request: new Request('https://jelementi.quz.ma/studio/articles/a-draft?/replace', {
          method: 'POST',
          body: form,
        }),
        platform: { env },
        locals: { studioGithubAdapter: replacementAdapter },
      },
      'a-draft',
    );

    expect(requireStudioMutation).toHaveBeenCalledTimes(1);
    expect(getMainRef).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      replacement: {
        kind: 'replacement_failed',
        phase: 'decode-request',
        reason: 'validation',
        candidate: {
          metadata: { slug: 'a-draft' },
          body: 'Keep this tampered submission visible.',
        },
      },
      editor: { metadata: { slug: 'a-draft' }, body: 'Keep this tampered submission visible.' },
    });
  });
});
