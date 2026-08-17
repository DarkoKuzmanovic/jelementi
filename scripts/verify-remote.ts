import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMediaBaseUrl, validateContent } from './content';
import { richContentSlug } from './verify-web';
import { verifyPublishedMedia, type MediaFetch } from './media';

const clientEntryPattern = /(?:\/_app\/immutable\/entry\/start|\bkit\.start\(\))/i;
const noindexPattern = /<meta\s+name=["']robots["']\s+content=["']noindex["']/i;
// Prerendered non-hydrated pages ship relative CSS (./_app or ../_app) and no client JS.
const staticAssetPattern =
  /(?:src|href)=["']((?:\.\.\/)*(?:\.\/)?_app\/immutable\/[^"']+\.(?:js|css)|\/_app\/immutable\/[^"']+\.(?:js|css))["']/i;

export interface RemoteHttpResponse {
  status: number;
  body: string;
  finalUrl: string;
  headers: Pick<Headers, 'get'>;
}

export interface RemoteArticleRoute {
  path: string;
  title: string;
  /**
   * Marks the seeded rich fixture article (sources + footnotes). Only that
   * page must render those sections; any other article may legally have
   * neither (#47).
   */
  rich?: boolean;
}

export interface RemoteCategoryRoute {
  path: string;
  name: string;
}

export interface RemoteRoutes {
  articles: readonly RemoteArticleRoute[];
  categories: readonly RemoteCategoryRoute[];
}

export interface VerifyRemoteOptions {
  baseUrl: string;
  routes: RemoteRoutes;
  fetch?: (url: string) => Promise<RemoteHttpResponse>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  verifyMedia?: () => Promise<void>;
}

interface GeneratedIndexEntry {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

export function parseRemoteBaseUrl(args: readonly string[]): string {
  const normalized = args[0] === '--' ? args.slice(1) : [...args];
  if (normalized.length !== 2 || normalized[0] !== '--base-url' || normalized[1] === undefined) {
    throw new Error('Usage: verify:remote -- --base-url <https-origin>');
  }
  const raw = normalized[1];
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`--base-url must be an absolute URL, received ${raw}.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`--base-url must use https, received ${parsed.protocol}.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('--base-url must not include credentials.');
  }
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    throw new Error('--base-url must be an origin (no path), e.g. https://jelementi.quz.ma');
  }
  return parsed.origin;
}

function assertSameOrigin(baseUrl: string, response: RemoteHttpResponse, path: string): void {
  const expected = new URL(baseUrl);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    assert(
      location !== null,
      `Redirect for ${path} missing Location header (HTTP ${response.status}).`,
    );
    const target = new URL(location, baseUrl);
    assert(
      target.origin === expected.origin,
      `Redirect for ${path} left the expected origin (${expected.origin} → ${target.origin}).`,
    );
    throw new Error(
      `Unexpected redirect for ${path}: HTTP ${response.status} to ${target.toString()}.`,
    );
  }
  let finalOrigin: string;
  try {
    finalOrigin = new URL(response.finalUrl).origin;
  } catch {
    throw new Error(`Response for ${path} has an invalid final URL: ${response.finalUrl}.`);
  }
  assert(
    finalOrigin === expected.origin,
    `Response for ${path} resolved to unexpected origin ${finalOrigin} (expected ${expected.origin}).`,
  );
}

function assertHtml(response: RemoteHttpResponse, path: string): void {
  assert(response.status === 200, `Expected HTTP 200 for ${path}, received ${response.status}.`);
  assert(noindexPattern.test(response.body), `Missing global noindex meta tag on ${path}.`);
}

function assertNoHydration(response: RemoteHttpResponse, path: string): void {
  assert(!clientEntryPattern.test(response.body), `Unexpected hydration client entry on ${path}.`);
}

function assertHydration(response: RemoteHttpResponse, path: string): void {
  assert(
    clientEntryPattern.test(response.body),
    `Missing intentional hydration client entry on ${path}.`,
  );
}

function extractStaticAssetPath(homeBody: string): string {
  const match = staticAssetPattern.exec(homeBody);
  assert(
    match?.[1] !== undefined,
    'Home page has no /_app/immutable/*.{js,css} static asset reference.',
  );
  const raw = match[1];
  const marker = '_app/immutable/';
  const at = raw.indexOf(marker);
  assert(at >= 0, 'Static asset path missing _app/immutable/ segment.');
  return `/${raw.slice(at)}`;
}

async function defaultFetch(url: string): Promise<RemoteHttpResponse> {
  const response = await fetch(url, { redirect: 'manual' });
  return {
    status: response.status,
    body: await response.text(),
    finalUrl: response.url || url,
    headers: response.headers,
  };
}

async function pollForReady(
  request: (url: string) => Promise<RemoteHttpResponse>,
  baseUrl: string,
  timeoutMs: number,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  const deadline = now() + timeoutMs;
  let lastFailure = 'no response';
  do {
    try {
      const response = await request(`${baseUrl}/`);
      assertSameOrigin(baseUrl, response, '/');
      if (response.status === 200) return;
      lastFailure = `HTTP ${response.status}`;
    } catch (error: unknown) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (now() >= deadline) break;
    await sleep(100);
  } while (now() < deadline);
  throw new Error(`Remote origin did not become ready within ${timeoutMs}ms (${lastFailure}).`);
}

export async function loadRemoteRoutes(rootDir: string): Promise<RemoteRoutes> {
  const index = JSON.parse(
    await readFile(join(rootDir, 'generated/index.json'), 'utf8'),
  ) as GeneratedIndexEntry[];
  if (index.length === 0) {
    throw new Error('Generated index has no published articles for remote verification.');
  }
  const articles = index.map((entry) => ({
    path: `/articles/${entry.slug}`,
    title: entry.title,
    ...(entry.slug === richContentSlug ? { rich: true } : {}),
  }));
  const categoriesBySlug = new Map<string, RemoteCategoryRoute>();
  for (const entry of index) {
    if (!categoriesBySlug.has(entry.categorySlug)) {
      categoriesBySlug.set(entry.categorySlug, {
        path: `/categories/${entry.categorySlug}`,
        name: entry.category,
      });
    }
  }
  return {
    articles,
    categories: [...categoriesBySlug.values()],
  };
}

export async function verifyRemote({
  baseUrl,
  routes,
  fetch: request = defaultFetch,
  now = Date.now,
  sleep = defaultSleep,
  timeoutMs = 30_000,
  verifyMedia,
}: VerifyRemoteOptions): Promise<void> {
  const origin = new URL(baseUrl).origin;
  await pollForReady(request, origin, timeoutMs, now, sleep);

  const home = await request(`${origin}/`);
  assertSameOrigin(origin, home, '/');
  assertHtml(home, '/');
  assertNoHydration(home, '/');
  assert(home.body.includes('Jelementi'), 'Missing Jelementi home content.');

  for (const article of routes.articles) {
    const response = await request(`${origin}${article.path}`);
    assertSameOrigin(origin, response, article.path);
    assertHtml(response, article.path);
    assertNoHydration(response, article.path);
    assert(
      response.body.includes(article.title),
      `Missing article title on ${article.path}: ${article.title}.`,
    );
    if (article.rich === true) {
      assert(response.body.includes('Sources'), `Missing Sources on ${article.path}.`);
      assert(response.body.includes('Footnotes'), `Missing Footnotes on ${article.path}.`);
    }
  }

  for (const category of routes.categories) {
    const response = await request(`${origin}${category.path}`);
    assertSameOrigin(origin, response, category.path);
    assertHtml(response, category.path);
    assertNoHydration(response, category.path);
    assert(
      response.body.includes(category.name),
      `Missing category name on ${category.path}: ${category.name}.`,
    );
  }

  const search = await request(`${origin}/search`);
  assertSameOrigin(origin, search, '/search');
  assertHtml(search, '/search');
  assertHydration(search, '/search');

  const searchQuery = await request(`${origin}/search?query=tristan`);
  assertSameOrigin(origin, searchQuery, '/search?query=tristan');
  assertHtml(searchQuery, '/search?query=tristan');
  assertHydration(searchQuery, '/search?query=tristan');

  const about = await request(`${origin}/about`);
  assertSameOrigin(origin, about, '/about');
  assertHtml(about, '/about');
  assertNoHydration(about, '/about');

  const staticAssetPath = extractStaticAssetPath(home.body);
  const asset = await request(`${origin}${staticAssetPath}`);
  assertSameOrigin(origin, asset, staticAssetPath);
  assert(
    asset.status >= 200 && asset.status < 300,
    `Static asset failed: ${staticAssetPath} (HTTP ${asset.status}).`,
  );

  const missing = await request(`${origin}/not-found`);
  assertSameOrigin(origin, missing, '/not-found');
  assert(missing.status === 404, `Unknown path must return HTTP 404, received ${missing.status}.`);
  assert(noindexPattern.test(missing.body), 'Missing global noindex meta tag on 404 fallback.');
  assert(
    clientEntryPattern.test(missing.body),
    'Missing fallback client bootstrap on 404 fallback.',
  );
  assert(missing.body.includes('Page not found'), 'Missing English Jelementi 404 copy.');
  assert(!missing.body.includes('http-equiv="refresh"'), '404 fallback must not redirect to /.');

  if (verifyMedia !== undefined) {
    await verifyMedia();
  }
}

async function defaultVerifyMedia(rootDir: string, fetchImpl: MediaFetch): Promise<void> {
  const mediaBaseUrl = loadMediaBaseUrl({ rootDir });
  const batch = await validateContent({ rootDir, mediaBaseUrl });
  await verifyPublishedMedia({ batch, fetch: fetchImpl });
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const baseUrl = parseRemoteBaseUrl(process.argv.slice(2));
  const routes = await loadRemoteRoutes(rootDir);
  const mediaFetch: MediaFetch = async (url, options) => fetch(url, options);
  await verifyRemote({
    baseUrl,
    routes,
    verifyMedia: () => defaultVerifyMedia(rootDir, mediaFetch),
  });
  console.log(`Remote production probe passed for ${baseUrl}.`);
}

function isMainEntry(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(argv1);
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
