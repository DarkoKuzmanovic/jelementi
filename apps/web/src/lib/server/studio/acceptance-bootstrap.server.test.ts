import { describe, expect, it, vi } from 'vitest';
import { deriveStudioArticleStatus } from './lifecycle.server';
import {
  STUDIO_ACCEPTANCE_ARTICLE_SLUG,
  STUDIO_ACCEPTANCE_LIVE_SLUG,
  STUDIO_ACCEPTANCE_RECOVERY_HEADER,
  applyStudioAcceptanceRecoveryScenario,
  injectStudioAcceptanceSelfBinding,
  isStudioAcceptanceMode,
  resolveStudioAcceptanceAdapter,
  studioAcceptanceProbeFetch,
} from './acceptance-bootstrap.server';

function envWith(overrides: Record<string, unknown>): WorkerEnv {
  return overrides as unknown as WorkerEnv;
}

describe('isStudioAcceptanceMode', () => {
  it('is true only when STUDIO_ACCEPTANCE_MODE is exactly "1"', () => {
    expect(isStudioAcceptanceMode(envWith({ STUDIO_ACCEPTANCE_MODE: '1' }))).toBe(true);
  });

  it('is false when the flag is absent, falsy, or the wrong type', () => {
    expect(isStudioAcceptanceMode(undefined)).toBe(false);
    expect(isStudioAcceptanceMode(envWith({}))).toBe(false);
    expect(isStudioAcceptanceMode(envWith({ STUDIO_ACCEPTANCE_MODE: 'true' }))).toBe(false);
    expect(isStudioAcceptanceMode(envWith({ STUDIO_ACCEPTANCE_MODE: 1 }))).toBe(false);
    expect(isStudioAcceptanceMode(envWith({ STUDIO_ACCEPTANCE_MODE: 0 }))).toBe(false);
  });
});

describe('resolveStudioAcceptanceAdapter', () => {
  it('seeds the representative saved-and-ready article through the real save domain function', async () => {
    const env = envWith({ GITHUB_REPO_OWNER: 'acme', GITHUB_REPO_NAME: 'site' });
    const adapter = await resolveStudioAcceptanceAdapter(env);

    const branch = await adapter.getBranch(`studio/article/${STUDIO_ACCEPTANCE_ARTICLE_SLUG}`);
    expect(branch.ok).toBe(true);

    const pullRequests = await adapter.listPullRequests(
      `studio/article/${STUDIO_ACCEPTANCE_ARTICLE_SLUG}`,
    );
    expect(pullRequests.ok).toBe(true);
    if (pullRequests.ok) expect(pullRequests.value).toHaveLength(1);
  });

  it('reconciles the deterministic Live fixture through the real status projection', async () => {
    const adapter = await resolveStudioAcceptanceAdapter(envWith({}));
    const status = await deriveStudioArticleStatus(adapter, STUDIO_ACCEPTANCE_LIVE_SLUG, {
      productionOrigin: 'https://studio-acceptance.invalid',
      mediaBaseUrl: 'https://media.studio-acceptance.invalid/',
      includeProbe: true,
      probeOptions: { fetch: studioAcceptanceProbeFetch, maxAttempts: 1 },
    });
    expect(status).toMatchObject({ ok: true, value: { kind: 'live' } });
  });

  it('resolves the same adapter for the same env object identity (one seed per runtime env)', async () => {
    const env = envWith({});
    const first = await resolveStudioAcceptanceAdapter(env);
    const second = await resolveStudioAcceptanceAdapter(env);
    expect(first).toBe(second);
  });

  it('resolves a distinct adapter for a distinct env object identity', async () => {
    const first = await resolveStudioAcceptanceAdapter(envWith({}));
    const second = await resolveStudioAcceptanceAdapter(envWith({}));
    expect(first).not.toBe(second);
  });
});

describe('studioAcceptanceProbeFetch', () => {
  it('returns deterministic matching article and index evidence for the Live fixture', async () => {
    const articleResponse = await studioAcceptanceProbeFetch(
      `https://studio-acceptance.invalid/articles/${STUDIO_ACCEPTANCE_LIVE_SLUG}`,
    );
    const indexResponse = await studioAcceptanceProbeFetch(
      'https://studio-acceptance.invalid/index.json',
    );
    expect(articleResponse.status).toBe(200);
    expect(await articleResponse.text()).toContain('jelementi-content-version');
    expect(indexResponse.status).toBe(200);
    expect(await indexResponse.json()).toEqual([
      expect.objectContaining({ slug: STUDIO_ACCEPTANCE_LIVE_SLUG }),
    ]);
  });

  it('keeps an unmerged fixture absent from the fake production surface', async () => {
    const response = await studioAcceptanceProbeFetch(
      'https://studio-acceptance.invalid/articles/lighthouse-watch',
    );
    expect(response.status).toBe(404);
  });
});

describe('applyStudioAcceptanceRecoveryScenario', () => {
  const acceptanceEnv = () => envWith({ STUDIO_ACCEPTANCE_MODE: '1' });
  const request = (scenario?: string) =>
    new Request('https://studio-acceptance.invalid/studio/articles/x', {
      headers: scenario === undefined ? {} : { [STUDIO_ACCEPTANCE_RECOVERY_HEADER]: scenario },
    });
  const mainSha = async (adapter: Awaited<ReturnType<typeof resolveStudioAcceptanceAdapter>>) => {
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    return main.value.sha;
  };

  it('is a no-op outside acceptance mode even with the header present', async () => {
    const env = envWith({});
    const adapter = await resolveStudioAcceptanceAdapter(env);
    const before = await mainSha(adapter);

    await applyStudioAcceptanceRecoveryScenario(
      request('main-moved'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    expect(await mainSha(adapter)).toBe(before);
  });

  it('changes nothing for an absent or unknown header value', async () => {
    const env = acceptanceEnv();
    const adapter = await resolveStudioAcceptanceAdapter(env);
    const before = await mainSha(adapter);

    await applyStudioAcceptanceRecoveryScenario(request(), env, STUDIO_ACCEPTANCE_ARTICLE_SLUG);
    await applyStudioAcceptanceRecoveryScenario(
      request('not-a-scenario'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    expect(await mainSha(adapter)).toBe(before);
  });

  it('main-moved advances main without touching the article draft branch', async () => {
    const env = acceptanceEnv();
    const adapter = await resolveStudioAcceptanceAdapter(env);
    const before = await mainSha(adapter);
    const branchName = `studio/article/${STUDIO_ACCEPTANCE_ARTICLE_SLUG}`;
    const branchBefore = await adapter.getBranch(branchName);
    if (!branchBefore.ok) throw new Error('draft branch missing');

    await applyStudioAcceptanceRecoveryScenario(
      request('main-moved'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    expect(await mainSha(adapter)).not.toBe(before);
    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).toBe(branchBefore.value.sha);
  });

  it('draft-moved lands one further commit on the article draft branch only', async () => {
    const env = acceptanceEnv();
    const adapter = await resolveStudioAcceptanceAdapter(env);
    const before = await mainSha(adapter);
    const branchName = `studio/article/${STUDIO_ACCEPTANCE_ARTICLE_SLUG}`;
    const branchBefore = await adapter.getBranch(branchName);
    if (!branchBefore.ok) throw new Error('draft branch missing');

    await applyStudioAcceptanceRecoveryScenario(
      request('draft-moved'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    const branchAfter = await adapter.getBranch(branchName);
    expect(branchAfter.ok && branchAfter.value.sha).not.toBe(branchBefore.value.sha);
    expect(await mainSha(adapter)).toBe(before);
  });

  it('save-offline fails exactly the next get-main-ref call, then recovers', async () => {
    const env = acceptanceEnv();
    const adapter = await resolveStudioAcceptanceAdapter(env);

    await applyStudioAcceptanceRecoveryScenario(
      request('save-offline'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    const failed = await adapter.getMainRef();
    expect(failed).toEqual({
      ok: false,
      failure: { operation: 'get-main-ref', reason: 'transport' },
    });
    const recovered = await adapter.getMainRef();
    expect(recovered.ok).toBe(true);
  });

  it('replace-late-offline moves main and fails exactly the next delete-branch call, then recovers', async () => {
    const env = acceptanceEnv();
    const adapter = await resolveStudioAcceptanceAdapter(env);
    const before = await mainSha(adapter);

    await applyStudioAcceptanceRecoveryScenario(
      request('replace-late-offline'),
      env,
      STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    );

    // Main moved (so a refreshed-evidence Replace still verifies as
    // eligible) and reads keep working — only the next delete-branch is
    // armed to fail, so a targeted Replace stops at the delete-branch phase
    // after the old Draft PR was already closed (the post-mutation partial
    // state).
    expect(await mainSha(adapter)).not.toBe(before);
    const failed = await adapter.deleteBranch('studio/article/never-exists', 'a'.repeat(40));
    expect(failed).toEqual({
      ok: false,
      failure: { operation: 'delete-branch', reason: 'transport' },
    });
    const recovered = await adapter.deleteBranch('studio/article/never-exists', 'a'.repeat(40));
    expect(recovered).toEqual({
      ok: false,
      failure: { operation: 'delete-branch', reason: 'not-found' },
    });
  });
});

describe('injectStudioAcceptanceSelfBinding', () => {
  it('sets SELF to the deterministic fake probe transport when absent', () => {
    const env = envWith({}) as Record<string, unknown>;
    injectStudioAcceptanceSelfBinding(env as unknown as WorkerEnv);
    expect(typeof (env.SELF as { fetch?: unknown }).fetch).toBe('function');
  });

  it('is idempotent and safe to call on every request', () => {
    const env = envWith({}) as Record<string, unknown>;
    injectStudioAcceptanceSelfBinding(env as unknown as WorkerEnv);
    const firstSelf = env.SELF;
    injectStudioAcceptanceSelfBinding(env as unknown as WorkerEnv);
    expect(env.SELF).toBe(firstSelf);
  });

  it('never overrides an already-present, working SELF binding', () => {
    const realFetch = vi.fn(async () => new Response('real', { status: 200 }));
    const env = envWith({ SELF: { fetch: realFetch } }) as Record<string, unknown>;
    injectStudioAcceptanceSelfBinding(env as unknown as WorkerEnv);
    expect((env.SELF as { fetch: unknown }).fetch).toBe(realFetch);
  });
});
