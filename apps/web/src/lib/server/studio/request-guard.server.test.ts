import { describe, expect, it } from 'vitest';
import {
  authorizeStudioMutation,
  authorizeStudioRequest,
  checkStudioOrigin,
  requireStudioAccess,
  requireStudioMutation,
} from './request-guard.server';

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

const productionOrigin = 'https://jelementi.quz.ma';

function request(origin?: string): Request {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  return new Request(`${productionOrigin}/studio`, { headers });
}

describe('checkStudioOrigin', () => {
  it('rejects a state-changing request without an Origin header', () => {
    expect(checkStudioOrigin(request(), productionOrigin)).toEqual({
      ok: false,
      reason: 'missing-origin',
    });
  });

  it('rejects a malformed Origin header', () => {
    expect(checkStudioOrigin(request('not-an-origin'), productionOrigin)).toEqual({
      ok: false,
      reason: 'invalid-origin',
    });
  });

  it('rejects a cross-origin request', () => {
    expect(checkStudioOrigin(request('https://evil.example'), productionOrigin)).toEqual({
      ok: false,
      reason: 'cross-origin',
    });
  });

  it('accepts the configured production origin and normalizes a configured path', () => {
    expect(checkStudioOrigin(request(productionOrigin), `${productionOrigin}/studio`)).toEqual({
      ok: true,
    });
  });
});

describe('requireStudioAccess', () => {
  it('throws a generic sanitized denial for an unauthenticated request', async () => {
    await expect(
      requireStudioAccess({ request: request(), platform: undefined }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: 'Studio access denied.' },
    });
  });
});

describe('authorizeStudioRequest', () => {
  it('fails closed when runtime configuration is unavailable', async () => {
    await expect(authorizeStudioRequest(request(productionOrigin), undefined)).resolves.toEqual({
      ok: false,
      reason: 'missing-config',
    });
  });
});

describe('authorizeStudioMutation', () => {
  it('rejects missing Origin before attempting Access verification', async () => {
    await expect(authorizeStudioMutation(request(), validEnv)).resolves.toEqual({
      ok: false,
      reason: 'missing-origin',
    });
  });

  it('rejects cross-origin requests before attempting Access verification', async () => {
    await expect(
      authorizeStudioMutation(request('https://evil.example'), validEnv),
    ).resolves.toEqual({
      ok: false,
      reason: 'cross-origin',
    });
  });

  it('keeps the Access guard in the mutation path after origin validation', async () => {
    await expect(authorizeStudioMutation(request(productionOrigin), validEnv)).resolves.toEqual({
      ok: false,
      reason: 'missing-assertion',
    });
  });

  it('throws a generic sanitized denial for a cross-origin mutation', async () => {
    await expect(
      requireStudioMutation({
        request: request('https://evil.example'),
        platform: { env: validEnv },
      }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: 'Studio request denied.' },
    });
  });
});
