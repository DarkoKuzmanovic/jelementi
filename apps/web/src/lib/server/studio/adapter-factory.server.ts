/**
 * Resolves the real, production GitHub adapter for Studio from the
 * Worker's runtime bindings. Pure and synchronous — no network I/O, no
 * caching. `hooks.server.ts` is responsible for caching the result per
 * `env` and for deciding which requests need it at all.
 */

import { getStudioConfig, StudioConfigError } from './config.server';
import { GithubApiAdapter } from './github-adapter.production';
import type { GithubAdapter } from './github-adapter';

/**
 * Builds a `GithubAdapter` from `env`, or returns `undefined` if Studio's
 * configuration is missing or malformed (`StudioConfigError`) — an
 * incomplete environment is an expected, fail-closed outcome here, not an
 * error; routes already treat `undefined` as "Studio unavailable" (503).
 * Any other, unexpected error still propagates rather than being
 * swallowed.
 */
export function resolveStudioGithubAdapter(env: WorkerEnv | undefined): GithubAdapter | undefined {
  try {
    const config = getStudioConfig(env);
    return new GithubApiAdapter(config.github);
  } catch (cause) {
    if (cause instanceof StudioConfigError) return undefined;
    throw cause;
  }
}
