/**
 * Cloudflare Access verification for every Studio server boundary.
 *
 * The `Cf-Access-Jwt-Assertion` header is verified with the current
 * Cloudflare-recommended path: the team-domain JWKS at
 * `<teamDomain>/cdn-cgi/access/certs`, exact issuer, exact application
 * audience, normal expiry/not-before validation, and a non-empty email claim
 * compared with the configured operator email after one documented
 * normalization rule (trim ASCII whitespace, then lowercase). Verification
 * fails closed and returns only stable reason codes — never token contents,
 * upstream bodies, keys, or stack traces. Production resolves the remote
 * JWKS; tests may inject a local JWKS through `options.jwks`.
 */

import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose';
import type { JSONWebKeySet } from 'jose';
import type { StudioAccessConfig } from './config.server';

export type StudioAccessFailureReason =
  | 'missing-config'
  | 'missing-assertion'
  | 'invalid-token'
  | 'missing-email'
  | 'wrong-email';

export type StudioAccessResult =
  | { ok: true; email: string }
  | { ok: false; reason: StudioAccessFailureReason };

export interface StudioAccessVerifyOptions {
  /** Local JWKS used by tests; production always resolves the team-domain JWKS. */
  jwks?: JSONWebKeySet;
}

/** One documented normalization rule: trim ASCII whitespace, then lowercase. */
export function normalizeOperatorEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidAccessConfig(config: StudioAccessConfig): boolean {
  return (
    config.teamDomain.trim().length > 0 &&
    config.audience.trim().length > 0 &&
    config.allowedEmail.trim().length > 0
  );
}

async function constantTimeEmailEquals(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ]);
  return timingSafeEqual(new Uint8Array(leftDigest), new Uint8Array(rightDigest));
}

/** Fixed-length byte comparison over the full digest with no early exit. */
function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.min(left.byteLength, right.byteLength);
  let difference = 0;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0 && left.byteLength === right.byteLength;
}

/**
 * Verifies a Cloudflare Access application token. Returns a bounded result
 * object; authentication failures never throw and never echo sensitive data.
 */
export async function verifyStudioAccess(
  assertion: string | null | undefined,
  config: StudioAccessConfig,
  options?: StudioAccessVerifyOptions,
): Promise<StudioAccessResult> {
  if (!isValidAccessConfig(config)) {
    return { ok: false, reason: 'missing-config' };
  }
  if (typeof assertion !== 'string' || assertion.length === 0) {
    return { ok: false, reason: 'missing-assertion' };
  }

  const teamDomain = config.teamDomain.trim().replace(/\/+$/, '');
  const jwks =
    options?.jwks === undefined
      ? createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
      : createLocalJWKSet(options.jwks);

  let payload: { email?: unknown };
  try {
    const verified = await jwtVerify(assertion, jwks, {
      issuer: teamDomain,
      audience: config.audience,
      algorithms: ['RS256'],
    });
    payload = verified.payload as { email?: unknown };
  } catch {
    return { ok: false, reason: 'invalid-token' };
  }

  const email = typeof payload.email === 'string' ? payload.email : undefined;
  if (email === undefined || email.trim().length === 0) {
    return { ok: false, reason: 'missing-email' };
  }

  const normalizedEmail = normalizeOperatorEmail(email);
  const matches = await constantTimeEmailEquals(
    normalizedEmail,
    normalizeOperatorEmail(config.allowedEmail),
  );
  if (!matches) {
    return { ok: false, reason: 'wrong-email' };
  }
  return { ok: true, email: normalizedEmail };
}
