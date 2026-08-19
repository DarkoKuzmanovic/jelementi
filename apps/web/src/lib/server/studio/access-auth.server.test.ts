import { describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { JSONWebKeySet } from 'jose';
import { normalizeOperatorEmail, verifyStudioAccess } from './access-auth.server';
import type { StudioAccessConfig } from './config.server';

const teamDomain = 'https://jelementi.cloudflareaccess.com';
const audience = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c';
const allowedEmail = 'Darko@Example.com';

const config: StudioAccessConfig = { teamDomain, audience, allowedEmail };

interface TestSigner {
  jwks: JSONWebKeySet;
  sign: (payload: Record<string, unknown>) => Promise<string>;
}

async function createSigner(): Promise<TestSigner> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(publicKey);
  const jwks: JSONWebKeySet = {
    keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
  };
  return {
    jwks,
    sign: (payload) =>
      new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(privateKey),
  };
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: teamDomain,
    aud: audience,
    email: 'darko@example.com',
    iat: now - 60,
    exp: now + 300,
    ...overrides,
  };
}

describe('normalizeOperatorEmail', () => {
  it('trims surrounding whitespace and lowercases the address', () => {
    expect(normalizeOperatorEmail('  Darko@Example.COM ')).toBe('darko@example.com');
  });
});

describe('verifyStudioAccess', () => {
  it('rejects a missing assertion before any verification work', async () => {
    expect(await verifyStudioAccess(undefined, config)).toEqual({
      ok: false,
      reason: 'missing-assertion',
    });
    expect(await verifyStudioAccess(null, config)).toEqual({
      ok: false,
      reason: 'missing-assertion',
    });
    expect(await verifyStudioAccess('', config)).toEqual({
      ok: false,
      reason: 'missing-assertion',
    });
  });

  it('fails closed when Access configuration is incomplete', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims());
    expect(
      await verifyStudioAccess(token, { ...config, allowedEmail: '  ' }, { jwks: signer.jwks }),
    ).toEqual({ ok: false, reason: 'missing-config' });
    expect(
      await verifyStudioAccess(token, { ...config, teamDomain: '' }, { jwks: signer.jwks }),
    ).toEqual({ ok: false, reason: 'missing-config' });
    expect(
      await verifyStudioAccess(token, { ...config, audience: '' }, { jwks: signer.jwks }),
    ).toEqual({ ok: false, reason: 'missing-config' });
  });

  it('accepts a token signed by the configured JWKS with the exact operator email', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims());
    const result = await verifyStudioAccess(token, config, { jwks: signer.jwks });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe('darko@example.com');
  });

  it('rejects a token signed by a different key', async () => {
    const signer = await createSigner();
    const other = await createSigner();
    const token = await signer.sign(validClaims());
    expect(await verifyStudioAccess(token, config, { jwks: other.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects a tampered token', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims());
    const [header, payload, signature] = token.split('.');
    if (header === undefined || payload === undefined || signature === undefined) {
      throw new Error('Signer returned a malformed JWT.');
    }
    const replacement = signature[0] === 'a' ? 'b' : 'a';
    const tampered = `${header}.${payload}.${replacement}${signature.slice(1)}`;
    expect(tampered).not.toBe(token);
    expect(await verifyStudioAccess(tampered, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects a token issued by a different Access team domain', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ iss: 'https://other.cloudflareaccess.com' }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects a token with a different application audience', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ aud: 'other-audience' }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects an expired token', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects a token that is not yet valid', async () => {
    const signer = await createSigner();
    const now = Math.floor(Date.now() / 1000);
    const token = await signer.sign(validClaims({ nbf: now + 300, exp: now + 600 }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
  });

  it('rejects a token without an email claim', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ email: undefined }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'missing-email',
    });
    const emptyToken = await signer.sign(validClaims({ email: '  ' }));
    expect(await verifyStudioAccess(emptyToken, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'missing-email',
    });
  });

  it('rejects a token whose email does not match the allowed operator', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ email: 'someone.else@example.com' }));
    expect(await verifyStudioAccess(token, config, { jwks: signer.jwks })).toEqual({
      ok: false,
      reason: 'wrong-email',
    });
  });

  it('compares the normalized claim with the normalized allowed email', async () => {
    const signer = await createSigner();
    const token = await signer.sign(validClaims({ email: '  darko@example.com  ' }));
    const result = await verifyStudioAccess(
      token,
      { ...config, allowedEmail: 'DARKO@Example.COM' },
      { jwks: signer.jwks },
    );
    expect(result.ok).toBe(true);
  });
});
