import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import {
  normalizeOperatorEmail,
  verifyStudioAccess,
  type StudioAccessFailureReason,
  type StudioAccessResult,
  type StudioAccessVerifyOptions,
} from './access-auth.server';
import { getStudioConfig } from './config.server';

export type StudioOriginFailureReason = 'missing-origin' | 'invalid-origin' | 'cross-origin';
export type StudioRequestFailureReason = StudioAccessFailureReason | StudioOriginFailureReason;

export type StudioRequestResult =
  { ok: true; email: string } | { ok: false; reason: StudioRequestFailureReason };

export type StudioServerEvent = Pick<RequestEvent, 'request' | 'platform'>;

export type StudioOriginResult = { ok: true } | { ok: false; reason: StudioOriginFailureReason };

/**
 * Header + fixed token identifying the Studio browser acceptance seam's
 * bounded test identity (#73). Not a secret — its only gate is the
 * `STUDIO_ACCEPTANCE_MODE` runtime binding, which real production never
 * defines. Exported so the acceptance bootstrap and the Playwright suite
 * share one source of truth instead of duplicating the literal.
 */
export const STUDIO_ACCEPTANCE_IDENTITY_HEADER = 'x-studio-acceptance-identity';
export const STUDIO_ACCEPTANCE_IDENTITY_TOKEN = 'studio-acceptance-fixture-identity-v1';

/**
 * Explicit origin validation for JSON and other non-form requests.
 * SvelteKit's built-in CSRF check covers form submissions, but Studio's
 * future state-changing endpoints use JSON envelopes and must not rely on it.
 */
export function checkStudioOrigin(request: Request, configuredOrigin: string): StudioOriginResult {
  const origin = request.headers.get('origin');
  if (origin === null || origin.length === 0) {
    return { ok: false, reason: 'missing-origin' };
  }

  const parsedOrigin = parseRequestOrigin(origin);
  const expectedOrigin = parseConfiguredOrigin(configuredOrigin);
  if (parsedOrigin === undefined || expectedOrigin === undefined) {
    return { ok: false, reason: 'invalid-origin' };
  }
  if (parsedOrigin !== expectedOrigin) {
    return { ok: false, reason: 'cross-origin' };
  }
  return { ok: true };
}

/** Authenticate a Studio read boundary without permitting state changes. */
export async function authorizeStudioRequest(
  request: Request,
  env: WorkerEnv | undefined,
  options?: StudioAccessVerifyOptions,
): Promise<StudioRequestResult> {
  const config = loadStudioConfig(env);
  if (!config.ok) return config;
  const acceptance = acceptanceIdentity(request, env, config.value.access.allowedEmail);
  if (acceptance !== undefined) return acceptance;
  return verifyAccess(request, config.value.access, options);
}

/**
 * Authenticate a Studio state-changing boundary. Origin validation is first so
 * a rejected cross-site JSON request cannot reach Access verification or a
 * future GitHub adapter call.
 */
export async function authorizeStudioMutation(
  request: Request,
  env: WorkerEnv | undefined,
  options?: StudioAccessVerifyOptions,
): Promise<StudioRequestResult> {
  const config = loadStudioConfig(env);
  if (!config.ok) return config;

  const origin = checkStudioOrigin(request, config.value.productionOrigin);
  if (!origin.ok) return origin;
  const acceptance = acceptanceIdentity(request, env, config.value.access.allowedEmail);
  if (acceptance !== undefined) return acceptance;
  return verifyAccess(request, config.value.access, options);
}

/**
 * The Studio browser acceptance seam's bounded test identity (#73). Real
 * Cloudflare Access verification is entirely bypassed by design here —
 * never partially — but ONLY when the runtime `env` explicitly carries
 * `STUDIO_ACCEPTANCE_MODE: '1'`, a binding the real production Wrangler
 * configuration never defines (mirrors ADR-0007's SELF-binding gate: no
 * binding, no bypass). Every other request path is untouched; this
 * function returns `undefined` immediately unless both the mode flag and
 * the exact bounded fixture token are present, falling through to the
 * ordinary `verifyAccess` call unchanged.
 */
function acceptanceIdentity(
  request: Request,
  env: WorkerEnv | undefined,
  allowedEmail: string,
): StudioAccessResult | undefined {
  if ((env as Readonly<Record<string, unknown>> | undefined)?.STUDIO_ACCEPTANCE_MODE !== '1') {
    return undefined;
  }
  const token = request.headers.get(STUDIO_ACCEPTANCE_IDENTITY_HEADER);
  if (token !== STUDIO_ACCEPTANCE_IDENTITY_TOKEN) return undefined;
  return { ok: true, email: allowedEmail };
}

/** Require a valid Studio identity or throw a generic sanitized denial. */
export async function requireStudioAccess(event: StudioServerEvent): Promise<{ email: string }> {
  const result = await authorizeStudioRequest(event.request, event.platform?.env);
  if (!result.ok) {
    error(403, 'Studio access denied.');
  }
  return { email: result.email };
}

/** Require a valid same-origin Studio mutation identity. */
export async function requireStudioMutation(event: StudioServerEvent): Promise<{ email: string }> {
  const result = await authorizeStudioMutation(event.request, event.platform?.env);
  if (!result.ok) {
    error(403, 'Studio request denied.');
  }
  return { email: result.email };
}

function loadStudioConfig(
  env: WorkerEnv | undefined,
):
  | { ok: true; value: ReturnType<typeof getStudioConfig> }
  | { ok: false; reason: 'missing-config' } {
  try {
    return { ok: true, value: getStudioConfig(env) };
  } catch {
    return { ok: false, reason: 'missing-config' };
  }
}

function verifyAccess(
  request: Request,
  config: ReturnType<typeof getStudioConfig>['access'],
  options?: StudioAccessVerifyOptions,
): Promise<StudioAccessResult> {
  return verifyStudioAccess(
    request.headers.get('Cf-Access-Jwt-Assertion'),
    {
      teamDomain: config.teamDomain,
      audience: config.audience,
      allowedEmail: normalizeOperatorEmail(config.allowedEmail),
    },
    options,
  );
}

function parseRequestOrigin(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return undefined;
    }
    const origin = parsed.origin;
    return origin === value ? origin : undefined;
  } catch {
    return undefined;
  }
}

function parseConfiguredOrigin(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}
