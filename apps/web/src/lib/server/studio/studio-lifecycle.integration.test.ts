import { describe, expect, it } from 'vitest';
import {
  compileArticle,
  serializeArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';
import { articleContentFingerprint, categorySlug } from '@jelementi/article-model';
import { validateCompiledBatch } from '../../../../../../scripts/content';
import type { StudioMetadata, StudioIndexEvidence } from '../../studio/contracts';
import { discardStudioDraft } from './discard.server';
import { saveStudioDraft } from './editor.server';
import { FakeGithubAdapter } from './github-adapter.fake';
import { deriveStudioArticleStatus } from './lifecycle.server';
import type { ProbeIndexResult, ProbeResult } from './probe.server';
import { publishStudioDraft } from './publish.server';
import { unpublishStudioArticle } from './unpublish.server';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};

const productionOrigin = 'https://jelementi.quz.ma';
const mediaBaseUrl = 'https://media.jelementi.quz.ma/';
const options = {
  mediaBaseUrl,
  fetch: async () => new Response(null, { status: 200 }),
};
const slug = 'lifecycle-article';
const path = `content/articles/${slug}.md`;
const branchName = `studio/article/${slug}`;

const publishedFrontmatter: ArticleSourceFrontmatter = {
  title: 'Lifecycle Article',
  slug,
  excerpt: 'An article driven through the complete Studio lifecycle.',
  publishedAt: '2026-08-20',
  updatedAt: '2026-08-20',
  status: 'published',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: `articles/${slug}/cover.svg`, alt: 'Lifecycle cover' },
  references: [],
};

const metadata: StudioMetadata = { ...publishedFrontmatter, references: [] };

function source(
  status: 'draft' | 'published' | 'archived',
  body: string,
  articleSlug = slug,
): string {
  return serializeArticleSource({
    frontmatter: {
      ...publishedFrontmatter,
      slug: articleSlug,
      title: articleSlug === slug ? publishedFrontmatter.title : articleSlug,
      status,
      ...(status === 'published' ? {} : { publishedAt: undefined }),
      cover: { src: `articles/${articleSlug}/cover.svg`, alt: `${articleSlug} cover` },
    },
    body,
  });
}

function seedPublished(adapter: FakeGithubAdapter, body = 'Canonical public body.'): string {
  const markdown = source('published', body);
  adapter.seedFile('main', path, markdown, 'b'.repeat(40));
  return markdown;
}

async function publicSlugs(adapter: FakeGithubAdapter): Promise<string[]> {
  const main = await adapter.getMainRef();
  if (!main.ok) throw new Error('main missing');
  const files = await adapter.listArticleFiles(main.value.sha);
  if (!files.ok) throw new Error('main files missing');
  const batch = validateCompiledBatch(
    files.value.map((file) => ({
      sourcePath: file.path,
      compiled: compileArticle({
        markdown: file.content,
        sourcePath: file.path,
        mediaBaseUrl,
      }),
    })),
  );
  return batch.published.map(({ compiled }) => compiled.document.slug);
}

function expectedIndex(markdown: string): Promise<{
  fingerprint: string;
  evidence: StudioIndexEvidence;
}> {
  const document = compileArticle({ markdown, sourcePath: path, mediaBaseUrl }).document;
  if (document.publishedAt === undefined) throw new Error('publishedAt missing');
  return articleContentFingerprint(document).then((fingerprint) => ({
    fingerprint,
    evidence: {
      slug: document.slug,
      title: document.title,
      excerpt: document.excerpt,
      publishedAt: document.publishedAt as string,
      updatedAt: document.updatedAt,
      category: document.category,
      categorySlug: categorySlug(document.category),
      tags: document.tags,
      author: document.author,
      cover: document.cover,
      readingTimeMinutes: document.readingTimeMinutes,
    },
  }));
}

function articleProbe(fingerprint: string): ProbeResult {
  return {
    ok: true,
    url: `${productionOrigin}/articles/${slug}?probe=1`,
    status: 200,
    fingerprint,
    headers: {},
    elapsedMs: 1,
    attempts: 1,
  };
}

function missingArticleProbe(): ProbeResult {
  return {
    ok: false,
    url: `${productionOrigin}/articles/${slug}?probe=1`,
    status: 404,
    fingerprint: null,
    headers: {},
    elapsedMs: 1,
    attempts: 1,
    reason: 'non-2xx',
  };
}

function indexProbe(entries: StudioIndexEvidence[]): ProbeIndexResult {
  return {
    ok: true,
    url: `${productionOrigin}/index.json?probe=1`,
    status: 200,
    entries,
    elapsedMs: 1,
    attempts: 1,
  };
}

describe('Studio lifecycle integration over FakeGithubAdapter', () => {
  it('keeps unsaved, draft, archived, and invalid branch content out of public output', async () => {
    const adapter = new FakeGithubAdapter(config);
    const canonical = seedPublished(adapter);
    adapter.seedFile(
      'main',
      'content/articles/draft-only.md',
      source('draft', 'Draft.', 'draft-only'),
      'c'.repeat(40),
    );
    adapter.seedFile(
      'main',
      'content/articles/archive-only.md',
      source('archived', 'Archived.', 'archive-only'),
      'd'.repeat(40),
    );
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');

    const invalid = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: '# Unsupported saved heading',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      options,
    );

    expect(invalid.kind).toBe('saved');
    if (invalid.kind !== 'saved') return;
    expect(invalid.compileIssues).not.toHaveLength(0);
    await expect(
      publishStudioDraft(adapter, slug, invalid.concurrency.draftHeadSha as string, options),
    ).resolves.toMatchObject({ kind: 'publish_rejected' });
    await expect(publicSlugs(adapter)).resolves.toEqual([slug]);
    const canonicalAfter = await adapter.getFileContent('main', path);
    expect(canonicalAfter.ok && canonicalAfter.value.content).toBe(canonical);

    const unsavedAdapter = new FakeGithubAdapter(config);
    seedPublished(unsavedAdapter);
    const unsavedMain = await unsavedAdapter.getMainRef();
    if (!unsavedMain.ok) throw new Error('unsaved main missing');
    const saved = await saveStudioDraft(
      unsavedAdapter,
      slug,
      {
        metadata,
        body: 'The exact committed body.',
        concurrency: { baseMainSha: unsavedMain.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      options,
    );
    if (saved.kind !== 'saved') throw new Error('save failed');
    const unsavedEditorText = 'A newer local edit that was never saved.';
    await publishStudioDraft(
      unsavedAdapter,
      slug,
      saved.concurrency.draftHeadSha as string,
      options,
    );
    unsavedAdapter.seedCheckRun(saved.pullRequest.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'success',
    });
    unsavedAdapter.mergePullRequest(saved.pullRequest.number);
    const published = await unsavedAdapter.getFileContent('main', path);
    expect(published.ok && published.value.content).toContain('The exact committed body.');
    expect(published.ok && published.value.content).not.toContain(unsavedEditorText);
  });

  it('shows failed checks without merging, then requires production fingerprint and index proof for Live', async () => {
    const adapter = new FakeGithubAdapter(config);
    seedPublished(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'The committed lifecycle edit.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      options,
    );
    if (saved.kind !== 'saved') throw new Error('save failed');
    const head = saved.concurrency.draftHeadSha as string;

    await expect(publishStudioDraft(adapter, slug, main.value.sha, options)).resolves.toMatchObject(
      {
        kind: 'publish_conflict',
      },
    );
    await expect(publishStudioDraft(adapter, slug, head, options)).resolves.toMatchObject({
      kind: 'published',
    });
    adapter.seedCheckRun(saved.pullRequest.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/19',
    });
    const failed = await deriveStudioArticleStatus(adapter, slug, {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    expect(failed).toMatchObject({ ok: true, value: { kind: 'check_failed' } });
    const stillOpen = await adapter.listPullRequests(branchName);
    expect(stillOpen.ok && stillOpen.value[0]?.state).toBe('open');
    expect(() => adapter.mergePullRequest(saved.pullRequest.number)).toThrow(
      'verify-check-not-successful',
    );

    const deployAdapter = new FakeGithubAdapter(config);
    seedPublished(deployAdapter);
    const deployMain = await deployAdapter.getMainRef();
    if (!deployMain.ok) throw new Error('deploy main missing');
    const deploySaved = await saveStudioDraft(
      deployAdapter,
      slug,
      {
        metadata,
        body: 'The committed lifecycle edit.',
        concurrency: { baseMainSha: deployMain.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      options,
    );
    if (deploySaved.kind !== 'saved') throw new Error('deploy save failed');
    const deployHead = deploySaved.concurrency.draftHeadSha as string;
    await publishStudioDraft(deployAdapter, slug, deployHead, options);
    deployAdapter.seedCheckRun(deploySaved.pullRequest.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'success',
    });
    const merged = deployAdapter.mergePullRequest(deploySaved.pullRequest.number);
    const pending = await deriveStudioArticleStatus(deployAdapter, slug, {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: false,
    });
    expect(pending).toMatchObject({ ok: true, value: { kind: 'merged', mainSha: merged } });

    const mergedFile = await deployAdapter.getFileContent('main', path);
    if (!mergedFile.ok) throw new Error('merged file missing');
    const proof = await expectedIndex(mergedFile.value.content);
    const mismatch = await deriveStudioArticleStatus(deployAdapter, slug, {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => articleProbe('0'.repeat(64)),
      probeIndex: async () => indexProbe([proof.evidence]),
    });
    expect(mismatch).toMatchObject({ ok: true, value: { kind: 'pending_deployment' } });

    const live = await deriveStudioArticleStatus(deployAdapter, slug, {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => articleProbe(proof.fingerprint),
      probeIndex: async () => indexProbe([proof.evidence]),
    });
    expect(live).toMatchObject({
      ok: true,
      value: { kind: 'live', mainSha: merged, contentVersion: proof.fingerprint },
    });

    const restarted = new FakeGithubAdapter(config);
    restarted.seedFile('main', path, mergedFile.value.content, mergedFile.value.blobSha);
    const restartedMain = await restarted.getMainRef();
    if (!restartedMain.ok) throw new Error('restart main missing');
    restarted.seedPullRequest(branchName, {
      state: 'merged',
      draft: false,
      headSha: deployHead,
      mergeCommitSha: restartedMain.value.sha,
    });
    const reconstructed = await deriveStudioArticleStatus(restarted, slug, {
      productionOrigin,
      mediaBaseUrl,
      includeProbe: true,
      probeArticle: async () => articleProbe(proof.fingerprint),
      probeIndex: async () => indexProbe([proof.evidence]),
    });
    expect(reconstructed).toMatchObject({
      ok: true,
      value: { kind: 'live', contentVersion: proof.fingerprint },
    });
  });

  it('fails closed when main moves and freezes the branch after approval', async () => {
    const adapter = new FakeGithubAdapter(config);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const first = await saveStudioDraft(
      adapter,
      slug,
      { metadata, body: 'Valid first draft.', concurrency: { baseMainSha: main.value.sha } },
      options,
    );
    if (first.kind !== 'saved') throw new Error('first save failed');
    adapter.advanceMain();

    await expect(
      saveStudioDraft(
        adapter,
        slug,
        { metadata, body: 'Must not land on stale main.', concurrency: first.concurrency },
        options,
      ),
    ).resolves.toMatchObject({ kind: 'save_conflict', loaded: first.concurrency });
    const staleBranch = await adapter.getBranch(branchName);
    expect(staleBranch.ok && staleBranch.value.sha).toBe(first.concurrency.draftHeadSha);

    const approvedAdapter = new FakeGithubAdapter(config);
    const approvedMain = await approvedAdapter.getMainRef();
    if (!approvedMain.ok) throw new Error('main missing');
    const approved = await saveStudioDraft(
      approvedAdapter,
      slug,
      {
        metadata,
        body: 'Approved body.',
        concurrency: { baseMainSha: approvedMain.value.sha },
      },
      options,
    );
    if (approved.kind !== 'saved') throw new Error('save failed');
    const approvedHead = approved.concurrency.draftHeadSha as string;
    await publishStudioDraft(approvedAdapter, slug, approvedHead, options);
    approvedAdapter.advanceMain();
    await expect(
      saveStudioDraft(
        approvedAdapter,
        slug,
        { metadata, body: 'Mutation after approval.', concurrency: approved.concurrency },
        options,
      ),
    ).resolves.toMatchObject({ kind: 'save_conflict', loaded: approved.concurrency });
    const frozen = await approvedAdapter.getBranch(branchName);
    expect(frozen.ok && frozen.value.sha).toBe(approvedHead);
  });

  it('blocks unpublish over a differing draft and discards a draft without changing main', async () => {
    const adapter = new FakeGithubAdapter(config);
    const canonical = seedPublished(adapter);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      slug,
      {
        metadata,
        body: 'A differing active draft.',
        concurrency: { baseMainSha: main.value.sha, expectedBlobSha: 'b'.repeat(40) },
      },
      options,
    );
    if (saved.kind !== 'saved') throw new Error('save failed');

    await expect(unpublishStudioArticle(adapter, slug, options)).resolves.toEqual({
      kind: 'unpublish_blocked',
      reason: 'differing-draft',
    });
    await expect(
      discardStudioDraft(adapter, slug, saved.concurrency.draftHeadSha as string),
    ).resolves.toMatchObject({ kind: 'discarded' });
    const mainAfter = await adapter.getMainRef();
    expect(mainAfter.ok && mainAfter.value.sha).toBe(main.value.sha);
    const canonicalAfter = await adapter.getFileContent('main', path);
    expect(canonicalAfter.ok && canonicalAfter.value.content).toBe(canonical);

    const unpublishAdapter = new FakeGithubAdapter(config);
    seedPublished(unpublishAdapter);
    const unpublish = await unpublishStudioArticle(unpublishAdapter, slug, options);
    expect(unpublish.kind).toBe('unpublish_submitted');
    if (unpublish.kind !== 'unpublish_submitted') return;
    unpublishAdapter.seedCheckRun(unpublish.pullRequest.number, {
      name: 'verify',
      status: 'completed',
      conclusion: 'success',
    });
    unpublishAdapter.mergePullRequest(unpublish.pullRequest.number);
    await expect(publicSlugs(unpublishAdapter)).resolves.toEqual([]);
    await expect(
      deriveStudioArticleStatus(unpublishAdapter, slug, {
        productionOrigin,
        mediaBaseUrl,
        includeProbe: true,
        probeArticle: async () => missingArticleProbe(),
        probeIndex: async () => indexProbe([]),
      }),
    ).resolves.toMatchObject({ ok: true, value: { kind: 'archived' } });
  });
});
