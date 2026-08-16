/**
 * GitHub App authentication: short-lived App JWT + installation-token
 * exchange, plus the pure PKCS#1→PKCS#8 PEM rewrap GitHub App downloads
 * need (`jose`'s `importPKCS8` accepts only PKCS#8).
 *
 * The token exchange is tested by injecting `fetch`. No credential ever
 * leaves the server, and failures carry only stable reason codes.
 */

import { importPKCS8, SignJWT } from 'jose';
import type { StudioGithubConfig } from './config.server';

export type GithubAppAuthFailureReason =
  | 'invalid-config'
  | 'invalid-private-key'
  | 'jwt-signing-failed'
  | 'token-exchange-failed'
  | 'unexpected-response';

export type GithubAppAuthResult<T> =
  { ok: true; value: T } | { ok: false; reason: GithubAppAuthFailureReason };

export interface GithubAppAuthOptions {
  fetch?: typeof globalThis.fetch;
  /** Seconds of JWT validity; GitHub caps App tokens at 10 minutes. */
  jwtLifetimeSeconds?: number;
  /** Optional narrower installation-token scope for a later adapter operation. */
  permissions?: Readonly<Record<string, 'read' | 'write'>>;
  repositories?: readonly string[];
  now?: () => number;
  /** Maximum time for token exchange, including bounded response reading. */
  timeoutMs?: number;
}

const DEFAULT_JWT_LIFETIME_SECONDS = 600;
const JWT_LEEWAY_SECONDS = 60;
const MAX_AUTH_RESPONSE_BYTES = 16_384;
const MAX_INSTALLATION_TOKEN_LENGTH = 4_096;
const MAX_INSTALLATION_TOKEN_LIFETIME_MS = 3_660_000;
const DEFAULT_TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;
const DEFAULT_INSTALLATION_PERMISSIONS = {
  checks: 'read',
  contents: 'read',
  metadata: 'read',
  pull_requests: 'read',
} as const;

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string | undefined> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new TextDecoder().decode(concatBytes(...chunks));
      if (value === undefined) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/** `-----BEGIN PRIVATE KEY-----` (PKCS#8) PEM header. */
const PKCS8_HEADER = '-----BEGIN PRIVATE KEY-----';
/** PKCS#1 RSA PEM header, as GitHub App downloads ship. */
const PKCS1_HEADER = '-----BEGIN RSA PRIVATE KEY-----';

/** PKCS#1 RSA AlgorithmIdentifier OID 1.2.840.113549.1.1.1. */
const RSA_OID = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);

/**
 * Converts a PEM RSA private key to PKCS#8 (`BEGIN PRIVATE KEY`), which is
 * the only form `jose`'s `importPKCS8` accepts. PKCS#8 input passes through
 * unchanged; PKCS#1 (`BEGIN RSA PRIVATE KEY`) is rewrapped as a PKCS#8
 * PrivateKeyInfo: `SEQUENCE { version 0, AlgorithmIdentifier, OCTET STRING }`.
 * Pure, bounded, and unit-tested.
 */
export function normalizePrivateKeyPem(pem: string): string {
  const hadTrailingNewline = /\n$/.test(pem.replace(/\r\n/g, '\n'));
  // Normalize line endings and strip surrounding blank space (a trailing
  // newline is the key's own line ending, preserved below).
  const normalized = pem
    .replace(/\r\n/g, '\n')
    .replace(/^[\s\u00a0]+/, '')
    .replace(/[\s\u00a0]+$/, '');
  if (normalized.startsWith(PKCS8_HEADER)) {
    return hadTrailingNewline ? `${normalized}\n` : normalized;
  }

  if (!normalized.startsWith(PKCS1_HEADER)) {
    throw new Error('invalid-private-key');
  }

  const body = normalized
    .split('\n')
    .filter((line) => !line.includes('-----'))
    .join('');
  const der = base64UrlToBytes(body);

  // PKCS#8 PrivateKeyInfo (RFC 5208) as OpenSSL emits it:
  //   SEQUENCE {
  //     INTEGER version (0)
  //     AlgorithmIdentifier { rsaEncryption 1.2.840.113549.1.1.1, NULL }
  //     OCTET STRING <PKCS#1 body>          -- the PKCS#1 RSAPrivateKey
  //   }
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const algorithm = new Uint8Array([0x30, 0x0d, ...RSA_OID, 0x05, 0x00]);
  const octet = new Uint8Array([0x04, ...encodeLength(der.length), ...der]);
  const inner = concatBytes(version, algorithm, octet);
  const outer = new Uint8Array([0x30, ...encodeLength(inner.length), ...inner]);

  return `${PKCS8_HEADER}\n${chunkBase64(bytesToBase64Url(outer))}\n-----END PRIVATE KEY-----\n`;
}

/**
 * Decodes standard base64 (PEM bodies are standard base64, not URL-safe)
 * with padding tolerance; throws on invalid input.
 */
export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Standard base64 encoding without padding (PEM bodies). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, '');
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** DER length encoding: short form under 128, long form above. */
function encodeLength(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function chunkBase64(value: string): string {
  return value.replace(/(.{64})/g, '$1\n').trimEnd();
}

/**
 * Creates the short-lived GitHub App JWT signed with the App's private key.
 * Never rejects the process: failures become a stable reason code.
 */
export async function createAppJwt(
  config: StudioGithubConfig,
  options?: GithubAppAuthOptions,
): Promise<GithubAppAuthResult<string>> {
  const lifetimeSeconds = options?.jwtLifetimeSeconds ?? DEFAULT_JWT_LIFETIME_SECONDS;
  if (
    config.clientId.trim().length === 0 ||
    config.privateKey.trim().length === 0 ||
    !Number.isInteger(lifetimeSeconds) ||
    lifetimeSeconds < 1 ||
    lifetimeSeconds > DEFAULT_JWT_LIFETIME_SECONDS
  ) {
    return { ok: false, reason: 'invalid-config' };
  }
  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(normalizePrivateKeyPem(config.privateKey), 'RS256');
  } catch {
    return { ok: false, reason: 'invalid-private-key' };
  }
  const nowSeconds = Math.floor((options?.now?.() ?? Date.now()) / 1000);
  try {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(config.clientId)
      .setIssuedAt(nowSeconds - JWT_LEEWAY_SECONDS)
      .setExpirationTime(nowSeconds + lifetimeSeconds)
      .sign(privateKey);
    return { ok: true, value: jwt };
  } catch {
    return { ok: false, reason: 'jwt-signing-failed' };
  }
}

/**
 * Exchanges the App JWT for a short-lived installation token at
 * `POST /app/installations/{installationId}/access_tokens`. The response is
 * validated as bounded JSON; anything else fails closed with a stable
 * reason. The token is not verified here — it is an opaque credential
 * returned to the adapter, which uses it only as an Authorization header.
 */
export async function exchangeInstallationToken(
  config: StudioGithubConfig,
  appJwt: string,
  options?: GithubAppAuthOptions,
): Promise<GithubAppAuthResult<{ token: string; expiresAt: string }>> {
  if (
    appJwt.trim().length === 0 ||
    !/^[0-9]+$/.test(config.installationId) ||
    config.installationId.length > 32
  ) {
    return { ok: false, reason: 'invalid-config' };
  }
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  const timeoutMs =
    options?.timeoutMs !== undefined && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TOKEN_EXCHANGE_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          repositories: options?.repositories ?? [config.repo],
          permissions: options?.permissions ?? DEFAULT_INSTALLATION_PERMISSIONS,
        }),
        signal: controller.signal,
      },
    );
  } catch {
    clearTimeout(timer);
    return { ok: false, reason: 'token-exchange-failed' };
  }
  try {
    if (!response.ok) return { ok: false, reason: 'token-exchange-failed' };
    const body = await readBoundedText(response, MAX_AUTH_RESPONSE_BYTES);
    if (body === undefined) return { ok: false, reason: 'unexpected-response' };
    const payload = JSON.parse(body) as unknown;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return { ok: false, reason: 'unexpected-response' };
    }
    const record = payload as Record<string, unknown>;
    const token =
      typeof record.token === 'string' &&
      record.token.length > 0 &&
      record.token.length <= MAX_INSTALLATION_TOKEN_LENGTH
        ? record.token
        : undefined;
    const expiresAt =
      typeof record.expires_at === 'string' &&
      record.expires_at.length <= 40 &&
      Number.isFinite(Date.parse(record.expires_at))
        ? record.expires_at
        : undefined;
    const lifetimeMs =
      expiresAt === undefined ? 0 : Date.parse(expiresAt) - (options?.now?.() ?? Date.now());
    if (
      token === undefined ||
      expiresAt === undefined ||
      lifetimeMs <= 0 ||
      lifetimeMs > MAX_INSTALLATION_TOKEN_LIFETIME_MS
    ) {
      return { ok: false, reason: 'unexpected-response' };
    }
    return { ok: true, value: { token, expiresAt } };
  } catch {
    return { ok: false, reason: timedOut ? 'token-exchange-failed' : 'unexpected-response' };
  } finally {
    clearTimeout(timer);
  }
}
