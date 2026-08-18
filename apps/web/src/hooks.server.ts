/**
 * Wires the real Studio GitHub adapter into `event.locals` for Studio
 * routes only — every other request is untouched and pays no cost.
 *
 * Cloudflare Worker bindings (`platform.env`) are the same object across
 * every request handled by one isolate, so the adapter (and its internal
 * GitHub token cache — see `github-adapter.production.ts`) is resolved
 * once per env and reused, keyed by env object identity rather than a
 * single global slot. `resolveStudioGithubAdapter` is fully synchronous,
 * so there is no interleaving risk while filling the cache.
 */

import type { Handle } from '@sveltejs/kit';
import { resolveStudioGithubAdapter } from './lib/server/studio/adapter-factory.server';
import {
  injectStudioAcceptanceSelfBinding,
  isStudioAcceptanceMode,
  resolveStudioAcceptanceAdapter,
} from './lib/server/studio/acceptance-bootstrap.server';
import type { GithubAdapter } from './lib/server/studio/github-adapter';

const adapterCache = new WeakMap<WorkerEnv, GithubAdapter | undefined>();

function cachedStudioGithubAdapter(env: WorkerEnv | undefined): GithubAdapter | undefined {
  if (env === undefined) return undefined;
  if (adapterCache.has(env)) return adapterCache.get(env);
  const adapter = resolveStudioGithubAdapter(env);
  adapterCache.set(env, adapter);
  return adapter;
}

/**
 * The Studio browser acceptance seam (#73): only reached when
 * `env.STUDIO_ACCEPTANCE_MODE === '1'`, a binding real production never
 * defines. Every other request path below is completely untouched.
 */
const acceptanceAdapterCache = new WeakMap<WorkerEnv, Promise<GithubAdapter>>();

function cachedStudioAcceptanceAdapter(env: WorkerEnv): Promise<GithubAdapter> {
  const cached = acceptanceAdapterCache.get(env);
  if (cached !== undefined) return cached;
  const built = resolveStudioAcceptanceAdapter(env);
  acceptanceAdapterCache.set(env, built);
  return built;
}

// `URL#pathname` is not percent-decoded (e.g. `/%73tudio` stays literal),
// so an oddly-encoded request will not match here. That is deliberately
// left as-is rather than decoded: the worst outcome is the existing
// fail-closed 503 path applying to a request it did not strictly need to
// (no adapter wired), never an authorization bypass — this hook only
// decides whether to attach an adapter, not whether a request is allowed.
function isStudioPath(pathname: string): boolean {
  return pathname === '/studio' || pathname.startsWith('/studio/');
}

export const handle: Handle = async ({ event, resolve }) => {
  if (isStudioPath(event.url.pathname)) {
    const env = event.platform?.env;
    const acceptanceMode = env !== undefined && isStudioAcceptanceMode(env);
    if (acceptanceMode) {
      // Deterministic fake probe transport (#73): substitutes only the
      // `SELF` binding *value*, at the same place the fake GitHub adapter
      // is substituted. Production's SELF-absent fail-closed 503 (ADR-0007)
      // is untouched — this never runs outside acceptance mode.
      injectStudioAcceptanceSelfBinding(env);
    }
    const adapter = acceptanceMode
      ? await cachedStudioAcceptanceAdapter(env as WorkerEnv)
      : cachedStudioGithubAdapter(env);
    if (adapter !== undefined) {
      (event.locals as Record<string, unknown>).studioGithubAdapter = adapter;
    }
  }
  return resolve(event);
};
