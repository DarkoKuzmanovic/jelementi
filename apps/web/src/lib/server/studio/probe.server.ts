/**
 * Production probe slot: bounded, cache-busted HTTPS fetches proving
 * content evidence (the public article fingerprint and index metadata).
 *
 * Probes are the only path to `live` (CONTEXT.md, spec). Each probe:
 *  - sets `no-cache` + cache-bust query params so Cloudflare never serves a
 *    stale edge copy,
 *  - retries with backoff up to a hard total deadline (default 30s),
 *  - returns a bounded result — never raw upstream bodies.
 *
 * Tests inject `fetch`/`now`/`sleep` exactly like `verifyRemote` in scripts/.
 */

export type ProbeFailureReason =
  'config' | 'invalid-url' | 'non-http' | 'timeout' | 'network' | 'non-2xx';

export interface ProbeOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  cacheBust?: () => string;
  headers?: Record<string, string>;
}

export interface ProbeResult {
  ok: boolean;
  url: string;
  status: number;
  fingerprint: string | null;
  headers: Record<string, string>;
  elapsedMs: number;
  attempts: number;
  reason?: ProbeFailureReason;
}

export interface ProbeTarget {
  url: string;
}

export interface ProbeSpec {
  name: string;
  target: ProbeTarget;
}

export interface ProbeOutcome {
  name: string;
  ok: boolean;
  status: number;
  fingerprint: string | null;
  reason?: ProbeFailureReason;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const CACHE_BUST_KEY = 'probe';
const PROBE_RESPONSE_HEADERS = ['cache-control', 'cf-cache-status', 'age', 'content-type'] as const;
const MAX_RESPONSE_HEADER_LENGTH = 256;

function nowMs(now?: () => number): number {
  return now === undefined ? Date.now() : now();
}

function sleepFor(sleep: ((ms: number) => Promise<void>) | undefined, ms: number): Promise<void> {
  return sleep === undefined ? new Promise((resolve) => setTimeout(resolve, ms)) : sleep(ms);
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function probeHeaders(overrides?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(overrides ?? {})) {
    if (name.toLowerCase() === 'cache-control' || name.toLowerCase() === 'pragma') continue;
    headers[name] = value;
  }
  headers['Cache-Control'] = 'no-cache';
  headers.Pragma = 'no-cache';
  return headers;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readBoundedBody(response: Response, maximumBytes = 4_000): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new TextDecoder().decode(concatBytes(chunks));
      if (value === undefined) continue;
      const remainingBytes = maximumBytes - totalBytes;
      if (value.byteLength > remainingBytes) {
        if (remainingBytes > 0) chunks.push(value.slice(0, remainingBytes));
        await reader.cancel();
        return `${new TextDecoder().decode(concatBytes(chunks))}\u2026`;
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function sanitizedResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of PROBE_RESPONSE_HEADERS) {
    const value = headers.get(name);
    if (value !== null && value.length <= MAX_RESPONSE_HEADER_LENGTH) result[name] = value;
  }
  return result;
}

function extractFingerprint(body: string): string | null {
  const match = /<meta[^>]+name="jelementi-content-version"[^>]+content="([^"]+)"/.exec(body);
  return match === null ? null : (match[1] ?? null);
}

/**
 * Probes one URL with retries, cache-busting, and a hard deadline. Returns a
 * bounded result; absence/timeout yield `ok: false` with a stable reason —
 * a probe can never report `live` on its own.
 */
export async function probeUrl(spec: ProbeSpec, options: ProbeOptions = {}): Promise<ProbeResult> {
  const startedAt = nowMs(options.now);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxAttempts = boundedInteger(
    options.maxAttempts,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
  );
  const baseDelayMs = Math.max(
    0,
    Math.min(
      DEFAULT_BASE_DELAY_MS,
      Number.isFinite(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS)
        ? Math.floor(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS)
        : DEFAULT_BASE_DELAY_MS,
    ),
  );
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const cacheBust = options.cacheBust ?? (() => crypto.randomUUID());

  let parsed: URL;
  try {
    parsed = new URL(spec.target.url);
  } catch {
    return {
      ok: false,
      url: spec.target.url,
      status: 0,
      fingerprint: null,
      headers: {},
      elapsedMs: 0,
      attempts: 0,
      reason: 'invalid-url',
    };
  }
  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      url: spec.target.url,
      status: 0,
      fingerprint: null,
      headers: {},
      elapsedMs: 0,
      attempts: 0,
      reason: 'non-http',
    };
  }

  let lastUrl = parsed.toString();
  let lastStatus = 0;
  let lastBody = '';
  let lastFingerprint: string | null = null;
  let lastHeaders: Record<string, string> = {};
  let attempts = 0;
  let deadlineExceeded = false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    attempts += 1;
    const attemptStart = nowMs(options.now);
    const remaining = timeoutMs - (attemptStart - startedAt);
    if (remaining <= 0) break;

    const requestUrl = new URL(parsed);
    requestUrl.searchParams.set(CACHE_BUST_KEY, cacheBust());
    lastUrl = requestUrl.toString();
    let attemptTimedOut = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => {
          attemptTimedOut = true;
          controller.abort();
          reject(new Error('probe-timeout'));
        },
        Math.max(1, remaining),
      );
    });
    try {
      const result = await Promise.race([
        fetchImpl(lastUrl, {
          method: 'GET',
          headers: probeHeaders(options.headers),
          signal: controller.signal,
        }).then(async (response) => ({ response, body: await readBoundedBody(response) })),
        timeout,
      ]);
      lastStatus = result.response.status;
      lastHeaders = sanitizedResponseHeaders(result.response.headers);
      lastBody = result.body;
      lastFingerprint = extractFingerprint(lastBody);
      if (result.response.ok) break;
    } catch {
      // Keep the last status/body; a thrown fetch failure is reported via
      // the final reason (network), never propagated.
      if (attemptTimedOut) deadlineExceeded = true;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    const elapsed = nowMs(options.now) - startedAt;
    const backoff = baseDelayMs * 2 ** attempt;
    const remainingAfterAttempt = timeoutMs - elapsed;
    const bounded = Math.max(0, Math.min(backoff, remainingAfterAttempt - 1));
    if (attempt < maxAttempts - 1 && bounded > 0) await sleepFor(options.sleep, bounded);
  }

  const elapsedMs = nowMs(options.now) - startedAt;
  if (lastStatus >= 200 && lastStatus < 300) {
    return {
      ok: true,
      url: lastUrl,
      status: lastStatus,
      fingerprint: lastFingerprint,
      headers: lastHeaders,
      elapsedMs,
      attempts,
    };
  }
  return {
    ok: false,
    url: lastUrl,
    status: lastStatus,
    fingerprint: lastFingerprint,
    headers: lastHeaders,
    elapsedMs,
    attempts,
    reason:
      lastStatus === 0 && (deadlineExceeded || nowMs(options.now) - startedAt >= timeoutMs)
        ? 'timeout'
        : lastStatus === 0
          ? 'network'
          : 'non-2xx',
  };
}

/**
 * Probes several targets (article page + index) and returns bounded
 * outcomes. Any failure yields `ok: false` for that probe — the caller
 * decides whether the set of outcomes proves `live`.
 */
export async function probeAll(
  specs: ProbeSpec[],
  options: ProbeOptions = {},
): Promise<ProbeOutcome[]> {
  const results = await Promise.all(specs.map((spec) => probeUrl(spec, options)));
  return results.map((result, index) => ({
    name: specs[index]?.name ?? String(index),
    ok: result.ok,
    status: result.status,
    fingerprint: result.fingerprint,
    ...(result.ok ? {} : { reason: result.reason }),
  }));
}
