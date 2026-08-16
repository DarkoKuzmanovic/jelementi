import { describe, expect, it } from 'vitest';
import { resolveStudioGithubAdapter } from './adapter-factory.server';
import { GithubApiAdapter } from './github-adapter.production';

/**
 * Mirrors config.server.test.ts's/request-guard.server.test.ts's fixture
 * convention: a complete, well-formed WorkerEnv object literal, not a
 * partial mock.
 */
const validEnv: WorkerEnv = {
  ACCESS_TEAM_DOMAIN: 'https://jelementi.cloudflareaccess.com',
  ACCESS_AUD: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
  ALLOWED_OPERATOR_EMAIL: 'darko@example.com',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_CLIENT_ID: 'Iv1.abc123def456',
  GITHUB_INSTALLATION_ID: '654321',
  GITHUB_REPO_OWNER: 'DarkoKuzmanovic',
  GITHUB_REPO_NAME: 'jelementi',
  PRODUCTION_ORIGIN: 'https://jelementi.quz.ma',
  PUBLIC_MEDIA_BASE_URL: 'https://media.jelementi.quz.ma/',
  GITHUB_APP_PRIVATE_KEY:
    '-----BEGIN RSA PRIVATE KEY-----\nZmFrZQ==\n-----END RSA PRIVATE KEY-----',
  R2_MEDIA: undefined,
};

function envWith(mutations: Partial<WorkerEnv>): WorkerEnv {
  return { ...validEnv, ...mutations };
}

describe('resolveStudioGithubAdapter', () => {
  it('returns a production GitHub adapter for a fully populated environment', () => {
    const adapter = resolveStudioGithubAdapter(envWith({}));

    expect(adapter).toBeInstanceOf(GithubApiAdapter);
  });

  it('returns undefined when a required binding is missing, rather than throwing', () => {
    const env = { ...validEnv };
    delete (env as Record<string, unknown>).GITHUB_APP_ID;

    expect(() => resolveStudioGithubAdapter(env as unknown as WorkerEnv)).not.toThrow();
    expect(resolveStudioGithubAdapter(env as unknown as WorkerEnv)).toBeUndefined();
  });

  it('returns undefined for a malformed binding (fails closed, same as getStudioConfig)', () => {
    const adapter = resolveStudioGithubAdapter(envWith({ ALLOWED_OPERATOR_EMAIL: 'not-an-email' }));

    expect(adapter).toBeUndefined();
  });

  it('returns undefined for undefined env (no platform bindings at all)', () => {
    expect(resolveStudioGithubAdapter(undefined)).toBeUndefined();
  });
});
