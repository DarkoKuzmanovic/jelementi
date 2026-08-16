import { generateKeyPairSync } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';
import { createAppJwt, exchangeInstallationToken } from './github-adapter.auth';
import type { StudioGithubConfig } from './config.server';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const config: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey,
};

const nowMs = 1_700_000_000_000;

describe('createAppJwt', () => {
  it('creates a short-lived RS256 JWT with bounded claims', async () => {
    const result = await createAppJwt(config, { now: () => nowMs });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(decodeProtectedHeader(result.value)).toMatchObject({ alg: 'RS256' });
    expect(decodeJwt(result.value)).toMatchObject({
      iss: 'Iv1.client',
      iat: 1_699_999_940,
      exp: 1_700_000_600,
    });
  });

  it('fails closed for invalid configuration and excessive JWT lifetime', async () => {
    await expect(
      createAppJwt({ ...config, privateKey: 'not-a-key' }, { now: () => nowMs }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-private-key' });
    await expect(
      createAppJwt(config, { now: () => nowMs, jwtLifetimeSeconds: 601 }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-config' });
  });
});

describe('exchangeInstallationToken', () => {
  it('uses the GitHub installation-token endpoint and validates the response', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(
        JSON.stringify({ token: 'ghs_test', expires_at: '2026-08-13T12:00:00Z' }),
        { status: 201 },
      );
    };
    const result = await exchangeInstallationToken(config, 'app-jwt', {
      fetch,
      now: () => Date.parse('2026-08-13T11:00:00Z'),
    });
    expect(result).toEqual({
      ok: true,
      value: { token: 'ghs_test', expiresAt: '2026-08-13T12:00:00Z' },
    });
    expect(requestUrl).toBe('https://api.github.com/app/installations/67890/access_tokens');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      Authorization: 'Bearer app-jwt',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'jelementi-studio',
    });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      repositories: ['jelementi'],
      permissions: { checks: 'read', contents: 'read', metadata: 'read', pull_requests: 'read' },
    });
  });

  it('aborts a stalled token exchange within its configured timeout', async () => {
    await expect(
      exchangeInstallationToken(config, 'app-jwt', {
        timeoutMs: 1,
        fetch: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      }),
    ).resolves.toEqual({ ok: false, reason: 'token-exchange-failed' });
  });

  it('rejects malformed or unbounded responses before returning credentials', async () => {
    const malformed = await exchangeInstallationToken(config, 'app-jwt', {
      fetch: async () => new Response(JSON.stringify({ token: 'ghs_test' }), { status: 200 }),
      now: () => Date.parse('2026-08-13T11:00:00Z'),
    });
    expect(malformed).toEqual({ ok: false, reason: 'unexpected-response' });

    const oversized = await exchangeInstallationToken(config, 'app-jwt', {
      fetch: async () => new Response('x'.repeat(16_385), { status: 200 }),
      now: () => Date.parse('2026-08-13T11:00:00Z'),
    });
    expect(oversized).toEqual({ ok: false, reason: 'unexpected-response' });
  });
});
