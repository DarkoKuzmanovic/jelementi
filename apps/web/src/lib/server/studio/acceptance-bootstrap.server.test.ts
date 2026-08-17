import { describe, expect, it, vi } from 'vitest';
import {
  STUDIO_ACCEPTANCE_ARTICLE_SLUG,
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
  it('always returns a deterministic 404, regardless of the probed URL', async () => {
    const articleResponse = await studioAcceptanceProbeFetch(
      'https://studio-acceptance.invalid/articles/lighthouse-watch',
    );
    const indexResponse = await studioAcceptanceProbeFetch(
      'https://studio-acceptance.invalid/index.json',
    );
    expect(articleResponse.status).toBe(404);
    expect(indexResponse.status).toBe(404);
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
