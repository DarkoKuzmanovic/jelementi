import { describe, expect, it } from 'vitest';
import { GithubApiAdapter } from './github-adapter.production';
import type { StudioGithubConfig } from './config.server';

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'not-used-by-injected-auth',
};

const mainSha = 'a'.repeat(40);
const draftSha = 'b'.repeat(40);
const blobSha = 'c'.repeat(40);
const pullNumber = 42;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function adapterFor(fetch: typeof globalThis.fetch): GithubApiAdapter {
  return new GithubApiAdapter(config, {
    fetch,
    authenticate: async () => ({
      ok: true as const,
      value: { token: 'ghs_test', expiresAt: '2099-01-01T00:00:00Z' },
    }),
    now: () => Date.parse('2026-08-13T11:00:00Z'),
  });
}

describe('GithubApiAdapter', () => {
  it('reads the main ref and maps GitHub failures without exposing upstream bodies', async () => {
    let requestInit: RequestInit | undefined;
    const adapter = adapterFor(async (_url, init) => {
      requestInit = init;
      return json({ message: 'private upstream detail' }, 403);
    });

    const result = await adapter.getMainRef();

    expect(result).toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'forbidden', status: 403 },
    });
    const headers = new Headers(requestInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer ghs_test');
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
    expect(JSON.stringify(result)).not.toContain('private upstream detail');
  });

  it('discovers article files, Studio branches, pull requests, and checks through bounded reads', async () => {
    const calls: string[] = [];
    const adapter = adapterFor(async (url) => {
      const requestUrl = new URL(String(url));
      calls.push(`${requestUrl.pathname}${requestUrl.search}`);

      if (requestUrl.pathname.endsWith('/git/ref/heads/main')) {
        return json({
          ref: 'refs/heads/main',
          object: { sha: mainSha, type: 'commit' },
        });
      }
      if (requestUrl.pathname.endsWith('/contents/content/articles')) {
        return json([
          {
            type: 'file',
            path: 'content/articles/hello-world.md',
            sha: blobSha,
          },
          {
            type: 'file',
            path: 'content/articles/README.txt',
            sha: 'd'.repeat(40),
          },
        ]);
      }
      if (requestUrl.pathname.endsWith('/contents/content/articles/hello-world.md')) {
        return json({
          type: 'file',
          path: 'content/articles/hello-world.md',
          sha: blobSha,
          encoding: 'base64',
          content: 'IyBIZWxsbyB3b3JsZAo=',
        });
      }
      if (requestUrl.pathname.endsWith('/branches')) {
        return json([
          {
            name: 'studio/article/hello-world',
            commit: { sha: draftSha },
          },
        ]);
      }
      if (requestUrl.pathname.endsWith('/pulls/42')) {
        return json({
          number: pullNumber,
          html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          state: 'open',
          draft: false,
          merged_at: null,
          head: {
            ref: 'studio/article/hello-world',
            sha: draftSha,
            repo: { full_name: 'DarkoKuzmanovic/jelementi' },
          },
          base: { ref: 'main' },
        });
      }
      if (requestUrl.pathname.endsWith('/pulls')) {
        return json([
          {
            number: pullNumber,
            html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
            state: 'open',
            draft: false,
            merged_at: null,
            head: {
              ref: 'studio/article/hello-world',
              sha: draftSha,
              repo: { full_name: 'DarkoKuzmanovic/jelementi' },
            },
            base: { ref: 'main' },
          },
        ]);
      }
      if (requestUrl.pathname.endsWith(`/commits/${draftSha}/check-runs`)) {
        return json({
          check_runs: [
            {
              name: 'verify',
              status: 'completed',
              conclusion: 'success',
              html_url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/7',
              completed_at: '2026-08-13T11:01:00Z',
            },
          ],
        });
      }
      throw new Error(`unexpected request: ${requestUrl}`);
    });

    const main = await adapter.getMainRef();
    const files = await adapter.listArticleFiles(mainSha);
    const branches = await adapter.listStudioBranches();
    const pulls = await adapter.listPullRequests('studio/article/hello-world');
    const check = await adapter.getCheckRun(pullNumber, 'verify');

    expect(main).toEqual({
      ok: true,
      value: {
        name: 'refs/heads/main',
        sha: mainSha,
        url: 'https://github.com/DarkoKuzmanovic/jelementi/tree/main',
      },
    });
    expect(files).toEqual({
      ok: true,
      value: [
        {
          path: 'content/articles/hello-world.md',
          content: '# Hello world\n',
          blobSha,
        },
      ],
    });
    expect(branches).toEqual({
      ok: true,
      value: [
        {
          name: 'studio/article/hello-world',
          sha: draftSha,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/hello-world',
        },
      ],
    });
    expect(pulls).toEqual({
      ok: true,
      value: [
        {
          number: pullNumber,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          headRef: 'studio/article/hello-world',
          headSha: draftSha,
          baseRef: 'main',
          draft: false,
          state: 'open',
        },
      ],
    });
    expect(check).toEqual({
      ok: true,
      value: {
        name: 'verify',
        status: 'completed',
        conclusion: 'success',
        url: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/7',
        completedAt: '2026-08-13T11:01:00Z',
      },
    });
    expect(calls).toContain(
      `/repos/DarkoKuzmanovic/jelementi/contents/content/articles?ref=${mainSha}`,
    );
    expect(calls).toContain(
      `/repos/DarkoKuzmanovic/jelementi/contents/content/articles/hello-world.md?ref=${mainSha}`,
    );
  });

  it('accumulates Studio branches across paginated responses', async () => {
    const adapter = adapterFor(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.searchParams.get('page') === '1') {
        return json([
          {
            name: 'studio/article/first',
            commit: { sha: mainSha },
          },
          ...Array.from({ length: 99 }, (_, index) => ({
            name: `ordinary-${index}`,
            commit: { sha: mainSha },
          })),
        ]);
      }
      return json([
        {
          name: 'studio/article/second',
          commit: { sha: draftSha },
        },
      ]);
    });

    await expect(adapter.listStudioBranches()).resolves.toEqual({
      ok: true,
      value: [
        {
          name: 'studio/article/first',
          sha: mainSha,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/first',
        },
        {
          name: 'studio/article/second',
          sha: draftSha,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/second',
        },
      ],
    });
  });

  it('fails closed when branch pagination remains saturated at its bound', async () => {
    let requests = 0;
    const adapter = adapterFor(async () => {
      requests += 1;
      return json(
        Array.from({ length: 100 }, (_, index) => ({
          name: `ordinary-${requests}-${index}`,
          commit: { sha: mainSha },
        })),
      );
    });

    await expect(adapter.listStudioBranches()).resolves.toEqual({
      ok: false,
      failure: { operation: 'list-branches', reason: 'validation' },
    });
    expect(requests).toBe(10);
  });

  it('rejects a directory response at the GitHub truncation boundary', async () => {
    const adapter = adapterFor(async () =>
      json(
        Array.from({ length: 1_000 }, (_, index) => ({
          type: 'file',
          path: `content/articles/notes-${index}.txt`,
          sha: blobSha,
        })),
      ),
    );

    await expect(adapter.listArticleFiles('main')).resolves.toEqual({
      ok: false,
      failure: { operation: 'list-article-files', reason: 'validation' },
    });
  });

  it('treats GitHub rate-limit responses as rate limits', async () => {
    const adapter = adapterFor(
      async () =>
        new Response(JSON.stringify({ message: 'rate limited' }), {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    );

    await expect(adapter.getMainRef()).resolves.toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'rate-limit', status: 403 },
    });
  });

  it('fails closed on malformed topology and malformed content', async () => {
    const malformedBranches = adapterFor(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/branches')) {
        return json([
          {
            name: 'studio/article/not a slug',
            commit: { sha: draftSha },
          },
        ]);
      }
      throw new Error(`unexpected request: ${path}`);
    });
    const branches = await malformedBranches.listStudioBranches();
    expect(branches).toEqual({
      ok: false,
      failure: { operation: 'list-branches', reason: 'topology' },
    });

    const malformedArticleDirectory = adapterFor(async () =>
      json([
        {
          type: 'file',
          path: 'content/articles/not a slug.md',
          sha: blobSha,
        },
      ]),
    );
    await expect(malformedArticleDirectory.listArticleFiles('main')).resolves.toEqual({
      ok: false,
      failure: { operation: 'list-article-files', reason: 'topology' },
    });

    const malformedFile = adapterFor(async () =>
      json({
        type: 'file',
        path: 'content/articles/hello-world.md',
        sha: blobSha,
        encoding: 'base64',
        content: 'not base64 %%%',
      }),
    );
    const file = await malformedFile.getFileContent('main', 'content/articles/hello-world.md');
    expect(file).toEqual({
      ok: false,
      failure: { operation: 'get-file-content', reason: 'validation' },
    });
  });

  it('selects the newest matching check by validated GitHub run id', async () => {
    const adapter = adapterFor(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith('/pulls/42')) {
        return json({
          number: pullNumber,
          html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          state: 'open',
          draft: true,
          merged_at: null,
          head: {
            ref: 'studio/article/hello-world',
            sha: draftSha,
            repo: { full_name: 'DarkoKuzmanovic/jelementi' },
          },
          base: { ref: 'main' },
        });
      }
      return json({
        check_runs: [
          { id: 2, name: 'verify', status: 'completed', conclusion: 'failure' },
          { id: 1, name: 'verify', status: 'completed', conclusion: 'success' },
        ],
      });
    });

    await expect(adapter.getCheckRun(pullNumber, 'verify')).resolves.toEqual({
      ok: true,
      value: { id: 2, name: 'verify', status: 'completed', conclusion: 'failure' },
    });
  });

  it('maps an incomplete check run without inventing completion evidence', async () => {
    const adapter = adapterFor(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith('/pulls/42')) {
        return json({
          number: pullNumber,
          html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          state: 'open',
          draft: true,
          merged_at: null,
          head: {
            ref: 'studio/article/hello-world',
            sha: draftSha,
            repo: { full_name: 'DarkoKuzmanovic/jelementi' },
          },
          base: { ref: 'main' },
        });
      }
      return json({
        check_runs: [
          { name: 'verify', status: 'in_progress', conclusion: null, completed_at: null },
        ],
      });
    });

    await expect(adapter.getCheckRun(pullNumber, 'verify')).resolves.toEqual({
      ok: true,
      value: { name: 'verify', status: 'in_progress', conclusion: null },
    });
  });

  it('aborts a stalled GitHub request and returns a stable transport failure', async () => {
    const adapter = new GithubApiAdapter(config, {
      requestTimeoutMs: 1,
      authenticate: async () => ({
        ok: true as const,
        value: { token: 'ghs_test', expiresAt: '2099-01-01T00:00:00Z' },
      }),
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });

    await expect(adapter.getMainRef()).resolves.toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'transport' },
    });
  });

  it('uses the injected authentication seam and maps transport failures', async () => {
    const adapter = new GithubApiAdapter(config, {
      fetch: async () => {
        throw new Error('network details must not escape');
      },
      authenticate: async () => ({ ok: false as const, reason: 'token-exchange-failed' }),
    });

    const result = await adapter.getMainRef();
    expect(result).toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'auth' },
    });

    const transport = adapterFor(async () => {
      throw new Error('network details must not escape');
    });
    const transportResult = await transport.getMainRef();
    expect(transportResult).toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'transport' },
    });
  });
});

describe('GithubApiAdapter write methods', () => {
  const branchName = 'studio/article/hello-world';
  const treeSha = 'd'.repeat(40);
  const newTreeSha = 'e'.repeat(40);
  const newCommitSha = 'f'.repeat(40);

  function request(url: string | URL | Request, init: RequestInit | undefined) {
    const requestUrl = new URL(String(url));
    return { path: requestUrl.pathname, method: init?.method ?? 'GET', init };
  }

  describe('createBranch', () => {
    it('creates a Studio branch from an observed main SHA', async () => {
      let captured: { path: string; method: string; init?: RequestInit } | undefined;
      const adapter = adapterFor(async (url, init) => {
        captured = request(url, init);
        return json({
          ref: `refs/heads/${branchName}`,
          object: { sha: mainSha, type: 'commit' },
        });
      });

      const result = await adapter.createBranch(branchName, mainSha);

      expect(result).toEqual({
        ok: true,
        value: {
          name: branchName,
          sha: mainSha,
          url: `https://github.com/DarkoKuzmanovic/jelementi/tree/${branchName}`,
        },
      });
      expect(captured?.path).toBe('/repos/DarkoKuzmanovic/jelementi/git/refs');
      expect(captured?.method).toBe('POST');
      expect(JSON.parse(String(captured?.init?.body))).toEqual({
        ref: `refs/heads/${branchName}`,
        sha: mainSha,
      });
    });

    it('treats an already-existing reference as a conflict, not a validation failure', async () => {
      const adapter = adapterFor(async () => json({ message: 'Reference already exists' }, 422));

      await expect(adapter.createBranch(branchName, mainSha)).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-branch', reason: 'conflict', status: 422 },
      });
    });

    it('rejects malformed branch names and SHAs without a request, and forbids main', async () => {
      const adapter = adapterFor(async () => {
        throw new Error('must not call GitHub for invalid input');
      });

      await expect(adapter.createBranch('not a slug', mainSha)).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-branch', reason: 'validation' },
      });
      await expect(adapter.createBranch(branchName, 'not-a-sha')).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-branch', reason: 'validation' },
      });
      await expect(adapter.createBranch('main', mainSha)).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-branch', reason: 'forbidden' },
      });
    });
  });

  describe('commitFile', () => {
    const validInput = {
      branch: branchName,
      path: 'content/articles/hello-world.md',
      content: '---\ntitle: Hello\n---\nBody.',
      message: 'Studio: save draft for hello-world',
      expectedHeadSha: draftSha,
    };

    function fullSequenceFetch(onRef?: () => void) {
      return async (url: string | URL | Request, init?: RequestInit) => {
        const { path, method } = request(url, init);
        if (path.endsWith(`/git/ref/heads/${branchName}`) && method === 'GET') {
          onRef?.();
          return json({
            ref: `refs/heads/${branchName}`,
            object: { sha: draftSha, type: 'commit' },
          });
        }
        if (path.endsWith(`/git/commits/${draftSha}`) && method === 'GET') {
          return json({ sha: draftSha, tree: { sha: treeSha } });
        }
        if (path.endsWith('/git/blobs') && method === 'POST') {
          return json({ sha: blobSha });
        }
        if (path.endsWith('/git/trees') && method === 'POST') {
          return json({ sha: newTreeSha });
        }
        if (path.endsWith('/git/commits') && method === 'POST') {
          return json({ sha: newCommitSha });
        }
        if (path.endsWith(`/git/ref/heads/${branchName}`) && method === 'PATCH') {
          return json({ ref: `refs/heads/${branchName}`, object: { sha: newCommitSha } });
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      };
    }

    it('commits through blob -> tree -> commit -> fast-forward ref update', async () => {
      const calls: string[] = [];
      const adapter = adapterFor(async (url, init) => {
        calls.push(`${request(url, init).method} ${request(url, init).path}`);
        return fullSequenceFetch()(url, init);
      });

      const result = await adapter.commitFile(validInput);

      expect(result).toEqual({
        ok: true,
        value: {
          commitSha: newCommitSha,
          commitUrl: `https://github.com/DarkoKuzmanovic/jelementi/commit/${newCommitSha}`,
          blobSha,
        },
      });
      expect(calls).toEqual([
        `GET /repos/DarkoKuzmanovic/jelementi/git/ref/heads/${branchName}`,
        `GET /repos/DarkoKuzmanovic/jelementi/git/commits/${draftSha}`,
        'POST /repos/DarkoKuzmanovic/jelementi/git/blobs',
        'POST /repos/DarkoKuzmanovic/jelementi/git/trees',
        'POST /repos/DarkoKuzmanovic/jelementi/git/commits',
        `PATCH /repos/DarkoKuzmanovic/jelementi/git/ref/heads/${branchName}`,
      ]);
    });

    it('fails closed on a stale expected head without writing any object', async () => {
      let requests = 0;
      const adapter = adapterFor(async (url, init) => {
        requests += 1;
        return fullSequenceFetch()(url, init);
      });

      const result = await adapter.commitFile({ ...validInput, expectedHeadSha: mainSha });

      expect(result).toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'conflict' },
      });
      expect(requests).toBe(1);
    });

    it('treats a non-fast-forward ref update as a conflict', async () => {
      const adapter = adapterFor(async (url, init) => {
        const { path, method } = request(url, init);
        if (path.endsWith(`/git/ref/heads/${branchName}`) && method === 'PATCH') {
          return json({ message: 'Update is not a fast forward' }, 422);
        }
        return fullSequenceFetch()(url, init);
      });

      await expect(adapter.commitFile(validInput)).resolves.toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'conflict', status: 422 },
      });
    });

    it('rejects out-of-bound input without a request, and forbids main', async () => {
      const adapter = adapterFor(async () => {
        throw new Error('must not call GitHub for invalid input');
      });

      await expect(
        adapter.commitFile({ ...validInput, path: 'content/articles/not slug.md' }),
      ).resolves.toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'validation' },
      });
      await expect(adapter.commitFile({ ...validInput, message: '' })).resolves.toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'validation' },
      });
      await expect(
        adapter.commitFile({ ...validInput, expectedHeadSha: 'not-a-sha' }),
      ).resolves.toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'validation' },
      });
      await expect(adapter.commitFile({ ...validInput, branch: 'main' })).resolves.toEqual({
        ok: false,
        failure: { operation: 'commit-file', reason: 'forbidden' },
      });
    });
  });

  describe('createPullRequest', () => {
    const validInput = {
      title: 'Studio draft: Hello world',
      body: 'Opened by Studio for a draft save.',
      head: branchName,
      base: 'main' as const,
      draft: true as const,
    };

    it('opens a Draft PR after confirming no open PR already exists for the head', async () => {
      const calls: string[] = [];
      const adapter = adapterFor(async (url, init) => {
        const { path, method } = request(url, init);
        calls.push(`${method} ${path}`);
        if (path.endsWith('/pulls') && method === 'GET') return json([]);
        if (path.endsWith('/pulls') && method === 'POST') {
          return json({
            number: pullNumber,
            html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
            state: 'open',
            draft: true,
            merged_at: null,
            head: {
              ref: branchName,
              sha: draftSha,
              repo: { full_name: 'DarkoKuzmanovic/jelementi' },
            },
            base: { ref: 'main' },
          });
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      });

      const result = await adapter.createPullRequest(validInput);

      expect(result).toEqual({
        ok: true,
        value: {
          number: pullNumber,
          url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          headRef: branchName,
          headSha: draftSha,
          baseRef: 'main',
          draft: true,
          state: 'open',
        },
      });
      expect(calls[0]).toBe('GET /repos/DarkoKuzmanovic/jelementi/pulls');
      expect(calls[1]).toBe('POST /repos/DarkoKuzmanovic/jelementi/pulls');
    });

    it('fails closed on unexpected topology when an open PR already exists for the head', async () => {
      let postCalled = false;
      const adapter = adapterFor(async (url, init) => {
        const { path, method } = request(url, init);
        if (path.endsWith('/pulls') && method === 'GET') {
          return json([
            {
              number: pullNumber,
              html_url: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
              state: 'open',
              draft: true,
              merged_at: null,
              head: {
                ref: branchName,
                sha: draftSha,
                repo: { full_name: 'DarkoKuzmanovic/jelementi' },
              },
              base: { ref: 'main' },
            },
          ]);
        }
        postCalled = true;
        throw new Error('must not create a second PR for the same head');
      });

      const result = await adapter.createPullRequest(validInput);

      expect(result).toEqual({
        ok: false,
        failure: { operation: 'create-pull-request', reason: 'topology' },
      });
      expect(postCalled).toBe(false);
    });

    it('rejects malformed input without a request', async () => {
      const adapter = adapterFor(async () => {
        throw new Error('must not call GitHub for invalid input');
      });

      await expect(
        adapter.createPullRequest({ ...validInput, base: 'develop' as 'main' }),
      ).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-pull-request', reason: 'validation' },
      });
      await expect(adapter.createPullRequest({ ...validInput, title: '   ' })).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-pull-request', reason: 'validation' },
      });
      await expect(
        adapter.createPullRequest({ ...validInput, head: 'not a slug' }),
      ).resolves.toEqual({
        ok: false,
        failure: { operation: 'create-pull-request', reason: 'validation' },
      });
    });
  });
});
