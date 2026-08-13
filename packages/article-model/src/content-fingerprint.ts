import type { ArticleDocument } from './schema';

/**
 * Minimal structural view of the Web Crypto and TextEncoder globals. The
 * article-model package compiles without DOM or Node types, and these globals
 * exist in Node 20+, Cloudflare Workers, and browsers, so the helper stays
 * framework-neutral without importing node:crypto.
 */
interface RuntimeDigest {
  digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer>;
}

interface RuntimeGlobals {
  crypto?: { subtle?: RuntimeDigest };
  TextEncoder?: new () => { encode(input: string): Uint8Array };
}

const runtime = globalThis as unknown as RuntimeGlobals;

/**
 * Canonical JSON serialization of a validated ArticleDocument: object keys are
 * sorted recursively in lexicographic order, array order is preserved, and the
 * output is compact (no insignificant whitespace). Repeated calls with
 * insertion-order-equivalent input produce byte-identical output.
 */
export function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('Cannot canonicalize a value that JSON.stringify cannot represent.');
  }
  return serialized;
}

/**
 * Lowercase 64-character SHA-256 hex digest of the canonical UTF-8 JSON bytes
 * of a validated ArticleDocument. Uses the standard Web Crypto API available in
 * Node 20+, Cloudflare Workers, and browsers; no Node-specific module is
 * imported so the code remains safe for client bundles.
 */
export async function articleContentFingerprint(document: ArticleDocument): Promise<string> {
  const subtle = runtime.crypto?.subtle;
  const TextEncoderConstructor = runtime.TextEncoder;
  if (subtle === undefined || TextEncoderConstructor === undefined) {
    throw new Error('Web Crypto is unavailable in this runtime.');
  }
  const bytes = new TextEncoderConstructor().encode(canonicalizeJson(document));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}
