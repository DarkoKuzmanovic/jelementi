import { describe, expect, it } from 'vitest';
import { getStudioConfig, StudioConfigError } from './config.server';
import type { StudioConfig } from './config.server';

/**
 * Every Studio/GitHub runtime binding declared in `wrangler.jsonc` /
 * `wrangler.m2.jsonc` (vars plus the `GITHUB_APP_PRIVATE_KEY` secret) must be
 * present and well-formed before any Studio boundary may run.
 */
const validEnv: Record<string, string> = {
  ACCESS_TEAM_DOMAIN: 'https://jelementi.cloudflareaccess.com',
  ACCESS_AUD: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
  ALLOWED_OPERATOR_EMAIL: 'Darko@Example.com',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_CLIENT_ID: 'Iv1.abc123def456',
  GITHUB_INSTALLATION_ID: '654321',
  GITHUB_REPO_OWNER: 'DarkoKuzmanovic',
  GITHUB_REPO_NAME: 'jelementi',
  PRODUCTION_ORIGIN: 'https://jelementi.quz.ma',
  PUBLIC_MEDIA_BASE_URL: 'https://media.jelementi.quz.ma/',
  GITHUB_APP_PRIVATE_KEY:
    '-----BEGIN RSA PRIVATE KEY-----\nZmFrZQ==\n-----END RSA PRIVATE KEY-----',
};

function envWith(mutations: Record<string, unknown>): WorkerEnv {
  return { ...validEnv, ...mutations } as unknown as WorkerEnv;
}

function captureConfigError(env: WorkerEnv): StudioConfigError {
  try {
    getStudioConfig(env);
  } catch (error) {
    if (error instanceof StudioConfigError) return error;
    throw new Error(`Expected StudioConfigError, received ${String(error)}.`);
  }
  throw new Error('Expected getStudioConfig to throw StudioConfigError.');
}

describe('getStudioConfig', () => {
  it('returns a complete typed config for a fully populated environment', () => {
    const config: StudioConfig = getStudioConfig(envWith({}));
    expect(config.access).toEqual({
      teamDomain: 'https://jelementi.cloudflareaccess.com',
      audience: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
      allowedEmail: 'darko@example.com',
    });
    expect(config.github).toEqual({
      appId: '123456',
      clientId: 'Iv1.abc123def456',
      installationId: '654321',
      owner: 'DarkoKuzmanovic',
      repo: 'jelementi',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nZmFrZQ==\n-----END RSA PRIVATE KEY-----',
    });
    expect(config.productionOrigin).toBe('https://jelementi.quz.ma');
    expect(config.mediaBaseUrl).toBe('https://media.jelementi.quz.ma/');
  });

  it('trims surrounding whitespace from configured values', () => {
    const config = getStudioConfig(
      envWith({
        ALLOWED_OPERATOR_EMAIL: '  Darko@Example.com  ',
        GITHUB_REPO_OWNER: ' DarkoKuzmanovic ',
      }),
    );
    expect(config.access.allowedEmail).toBe('darko@example.com');
    expect(config.github.owner).toBe('DarkoKuzmanovic');
  });

  it('fails closed when the Access team domain is missing', () => {
    expect(captureConfigError(envWith({ ACCESS_TEAM_DOMAIN: undefined })).missingBindings).toEqual([
      'ACCESS_TEAM_DOMAIN',
    ]);
  });

  it('rejects a non-https Access team domain', () => {
    expect(
      captureConfigError(envWith({ ACCESS_TEAM_DOMAIN: 'http://jelementi.cloudflareaccess.com' }))
        .missingBindings,
    ).toEqual(['ACCESS_TEAM_DOMAIN']);
  });

  it('fails closed when the Access audience is missing', () => {
    expect(captureConfigError(envWith({ ACCESS_AUD: undefined })).missingBindings).toEqual([
      'ACCESS_AUD',
    ]);
  });

  it('fails closed when the operator email is empty', () => {
    expect(captureConfigError(envWith({ ALLOWED_OPERATOR_EMAIL: '  ' })).missingBindings).toEqual([
      'ALLOWED_OPERATOR_EMAIL',
    ]);
  });

  it('rejects an operator email without an @ address', () => {
    expect(
      captureConfigError(envWith({ ALLOWED_OPERATOR_EMAIL: 'not-an-email' })).missingBindings,
    ).toEqual(['ALLOWED_OPERATOR_EMAIL']);
  });

  it('fails closed when the GitHub private key secret is missing', () => {
    expect(
      captureConfigError(envWith({ GITHUB_APP_PRIVATE_KEY: undefined })).missingBindings,
    ).toEqual(['GITHUB_APP_PRIVATE_KEY']);
  });

  it('rejects a private key that is not a PEM block', () => {
    expect(
      captureConfigError(envWith({ GITHUB_APP_PRIVATE_KEY: 'not-a-pem' })).missingBindings,
    ).toEqual(['GITHUB_APP_PRIVATE_KEY']);
  });

  it('fails closed when a repository identity is missing', () => {
    expect(
      captureConfigError(envWith({ GITHUB_REPO_OWNER: undefined, GITHUB_REPO_NAME: undefined }))
        .missingBindings,
    ).toEqual(['GITHUB_REPO_NAME', 'GITHUB_REPO_OWNER']);
  });

  it('rejects a non-numeric GitHub installation id', () => {
    expect(captureConfigError(envWith({ GITHUB_INSTALLATION_ID: 'abc' })).missingBindings).toEqual([
      'GITHUB_INSTALLATION_ID',
    ]);
  });

  it('rejects a malformed production origin', () => {
    expect(captureConfigError(envWith({ PRODUCTION_ORIGIN: 'not-a-url' })).missingBindings).toEqual(
      ['PRODUCTION_ORIGIN'],
    );
  });

  it('fails closed when the media base URL is missing', () => {
    expect(
      captureConfigError(envWith({ PUBLIC_MEDIA_BASE_URL: undefined })).missingBindings,
    ).toEqual(['PUBLIC_MEDIA_BASE_URL']);
  });

  it('reports every missing binding in sorted order', () => {
    expect(
      captureConfigError(
        envWith({
          ACCESS_AUD: undefined,
          ACCESS_TEAM_DOMAIN: undefined,
          GITHUB_APP_PRIVATE_KEY: undefined,
        }),
      ).missingBindings,
    ).toEqual(['ACCESS_AUD', 'ACCESS_TEAM_DOMAIN', 'GITHUB_APP_PRIVATE_KEY']);
  });

  it('never echoes configured values in the error message', () => {
    const secretMarker = 'SUPER-SECRET-MARKER-42';
    const error = captureConfigError(
      envWith({ GITHUB_APP_PRIVATE_KEY: `not-a-pem-${secretMarker}` }),
    );
    expect(error.message).not.toContain(secretMarker);
    expect(error.message).toContain('GITHUB_APP_PRIVATE_KEY');
  });
});
