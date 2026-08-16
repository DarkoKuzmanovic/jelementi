import type { Handle } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server';

const validEnv: WorkerEnv = {
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

type MinimalEvent = Parameters<Handle>[0]['event'];

function eventFor(
  pathname: string,
  env: WorkerEnv | undefined,
  locals: Record<string, unknown> = {},
): MinimalEvent {
  return {
    url: new URL(`https://jelementi.quz.ma${pathname}`),
    platform: env === undefined ? undefined : { env },
    locals,
  } as unknown as MinimalEvent;
}

function stubResolve() {
  const response = new Response('ok');
  let calls = 0;
  const resolve: Parameters<Handle>[0]['resolve'] = async () => {
    calls += 1;
    return response;
  };
  return { resolve, response, callCount: () => calls };
}

describe('handle (hooks.server.ts)', () => {
  it('wires a real Studio GitHub adapter into locals for /studio', async () => {
    const locals: Record<string, unknown> = {};
    const { resolve, response } = stubResolve();

    const result = await handle({ event: eventFor('/studio', validEnv, locals), resolve });

    expect(result).toBe(response);
    expect(locals.studioGithubAdapter).toBeDefined();
  });

  it('wires the adapter for nested Studio routes too', async () => {
    const locals: Record<string, unknown> = {};
    const { resolve } = stubResolve();

    await handle({ event: eventFor('/studio/articles/new', validEnv, locals), resolve });

    expect(locals.studioGithubAdapter).toBeDefined();
  });

  it('does not touch locals for a non-Studio path', async () => {
    const locals: Record<string, unknown> = {};
    const { resolve } = stubResolve();

    await handle({ event: eventFor('/articles/some-slug', validEnv, locals), resolve });

    expect(locals.studioGithubAdapter).toBeUndefined();
  });

  it('leaves locals unset for /studio when config is invalid, matching the existing fail-closed 503 paths', async () => {
    const locals: Record<string, unknown> = {};
    const { resolve } = stubResolve();
    const brokenEnv = { ...validEnv, GITHUB_APP_ID: '' } as unknown as WorkerEnv;

    await handle({ event: eventFor('/studio', brokenEnv, locals), resolve });

    expect(locals.studioGithubAdapter).toBeUndefined();
  });

  it('leaves locals unset for /studio when there is no platform env at all', async () => {
    const locals: Record<string, unknown> = {};
    const { resolve } = stubResolve();

    await handle({ event: eventFor('/studio', undefined, locals), resolve });

    expect(locals.studioGithubAdapter).toBeUndefined();
  });

  it('always calls resolve and returns its response', async () => {
    const { resolve, response, callCount } = stubResolve();

    const result = await handle({ event: eventFor('/about', validEnv, {}), resolve });

    expect(callCount()).toBe(1);
    expect(result).toBe(response);
  });

  it('reuses the same adapter instance across requests within one module lifetime', async () => {
    // A dedicated env object (not the shared `validEnv` other tests in this
    // file also touch) so this test proves reuse from its own cold cache
    // entry, independent of test execution order.
    const dedicatedEnv: WorkerEnv = { ...validEnv };
    const localsA: Record<string, unknown> = {};
    const localsB: Record<string, unknown> = {};
    const { resolve } = stubResolve();

    await handle({ event: eventFor('/studio', dedicatedEnv, localsA), resolve });
    await handle({ event: eventFor('/studio/articles/new', dedicatedEnv, localsB), resolve });

    expect(localsA.studioGithubAdapter).toBeDefined();
    expect(localsA.studioGithubAdapter).toBe(localsB.studioGithubAdapter);
  });
});
