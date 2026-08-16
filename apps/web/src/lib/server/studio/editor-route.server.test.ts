import { describe, expect, it, vi } from 'vitest';
import { serializeArticleSource } from '@jelementi/content-compiler';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { StudioGithubConfig } from './config.server';
import { loadStudioEditorPage, previewStudioEditorAction } from './editor-route.server';

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

  it('previews the submitted body through the server compiler without a GitHub write', async () => {
    const form = validForm();
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
