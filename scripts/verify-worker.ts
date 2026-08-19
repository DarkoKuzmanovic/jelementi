import { spawn as spawnChild, type ChildProcess } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { richContentSlug } from './verify-web';

const clientEntryPattern = /(?:\/_app\/immutable\/entry\/start|\bkit\.start\(\))/i;
const noindexPattern = /<meta\s+name=["']robots["']\s+content=["']noindex["']/i;

export interface WorkerChild {
  kill(signal?: NodeJS.Signals): boolean | void;
  exited: Promise<void>;
}

export interface WorkerHttpResponse {
  status: number;
  body: string;
  headers: Pick<Headers, 'get'>;
}

export interface WorkerRoutes {
  articlePath: string;
  categoryPath: string;
  articleTitle: string;
  categoryName: string;
  /**
   * Page of the seeded rich fixture article (sources + footnotes), when it
   * is present in the generated index. The newest article is whatever the
   * operator last published and may legally have neither (#47).
   */
  richArticlePath?: string;
}

export interface WorkerSourceFile {
  path: string;
  source: string;
}

export interface VerifyWorkerOptions {
  rootDir: string;
  routes: WorkerRoutes;
  port?: number;
  timeoutMs?: number;
  staticAssetPath?: string;
  spawn?: (command: string, args: string[], options: { cwd: string }) => WorkerChild;
  fetch?: (url: string) => Promise<WorkerHttpResponse>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  reapTermTimeoutMs?: number;
  reapKillTimeoutMs?: number;
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

function assertHtml(response: WorkerHttpResponse, path: string): void {
  assert(response.status === 200, `Expected HTTP 200 for ${path}, received ${response.status}.`);
  assert(noindexPattern.test(response.body), `Missing global noindex meta tag on ${path}.`);
}

function assertNoHydration(response: WorkerHttpResponse, path: string): void {
  assert(!clientEntryPattern.test(response.body), `Unexpected hydration client entry on ${path}.`);
}

function assertHydration(response: WorkerHttpResponse, path: string): void {
  assert(
    clientEntryPattern.test(response.body),
    `Missing intentional hydration client entry on ${path}.`,
  );
}

async function pollForReady(
  request: (url: string) => Promise<WorkerHttpResponse>,
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
      if (response.status === 200) return;
      lastFailure = `HTTP ${response.status}`;
    } catch (error: unknown) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (now() >= deadline) break;
    await sleep(100);
  } while (now() < deadline);
  throw new Error(`Local Worker did not become ready within ${timeoutMs}ms (${lastFailure}).`);
}

async function raceExit(
  exited: Promise<void>,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = now() + timeoutMs;
  let settled = false;
  void exited.then(() => {
    settled = true;
  });
  for (;;) {
    if (settled) return true;
    if (now() >= deadline) return false;
    await sleep(50);
  }
}

async function reap(
  child: WorkerChild,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
  termTimeoutMs: number,
  killTimeoutMs: number,
): Promise<void> {
  child.kill('SIGTERM');
  if (await raceExit(child.exited, now, sleep, termTimeoutMs)) return;
  child.kill('SIGKILL');
  if (await raceExit(child.exited, now, sleep, killTimeoutMs)) return;
  throw new Error('Local Worker child did not exit after SIGTERM and SIGKILL.');
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function defaultFetch(url: string): Promise<WorkerHttpResponse> {
  const response = await fetch(url, { redirect: 'manual' });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

interface LocalWorkerConfig {
  configPath: string;
  persistTo: string;
  cleanup(): Promise<void>;
}

async function createLocalWorkerConfig(rootDir: string): Promise<LocalWorkerConfig> {
  const directory = await mkdtemp(join(tmpdir(), 'jelementi-wrangler-smoke-'));
  const configPath = join(directory, 'wrangler.json');
  const persistTo = join(directory, 'state');
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        name: 'jelementi-web-local-smoke',
        main: join(rootDir, '.svelte-kit/cloudflare/_worker.js'),
        compatibility_date: '2026-07-26',
        compatibility_flags: ['nodejs_compat'],
        assets: {
          binding: 'ASSETS',
          directory: join(rootDir, '.svelte-kit/cloudflare'),
          not_found_handling: '404-page',
        },
        r2_buckets: [{ binding: 'R2_MEDIA', bucket_name: 'jelementi-media' }],
      },
      null,
      2,
    )}\n`,
  );
  return {
    configPath,
    persistTo,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function defaultSpawn(rootDir: string, port: number, config: LocalWorkerConfig): WorkerChild {
  const process: ChildProcess = spawnChild(
    join(rootDir, 'node_modules/.bin/wrangler'),
    [
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--config',
      config.configPath,
      '--persist-to',
      config.persistTo,
      '--log-level',
      'warn',
      '--show-interactive-dev-session=false',
    ],
    { cwd: dirname(config.configPath), stdio: 'inherit' },
  );
  const exited = new Promise<void>((resolveExit) => {
    process.once('close', () => resolveExit());
    process.once('error', () => resolveExit());
  });
  return {
    kill: (signal) => process.kill(signal),
    exited,
  };
}

export function assertNoR2MediaBinding(files: readonly WorkerSourceFile[]): void {
  for (const file of files) {
    if (file.source.includes('R2_MEDIA')) {
      throw new Error(`Application source must not access R2_MEDIA: ${file.path}.`);
    }
  }
}

export async function verifyWorker({
  rootDir,
  routes,
  port = 8787,
  timeoutMs = 15_000,
  staticAssetPath = '/_app/immutable/entry/start.js',
  spawn,
  fetch: request = defaultFetch,
  now = Date.now,
  sleep = defaultSleep,
  reapTermTimeoutMs = 5_000,
  reapKillTimeoutMs = 5_000,
}: VerifyWorkerOptions): Promise<void> {
  const localConfig = spawn === undefined ? await createLocalWorkerConfig(rootDir) : undefined;
  const launch =
    spawn ??
    ((_command: string, _args: string[], options: { cwd: string }) =>
      defaultSpawn(options.cwd, port, localConfig as LocalWorkerConfig));
  let child: WorkerChild | undefined;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    child = launch('pnpm', [], { cwd: rootDir });
    await pollForReady(request, baseUrl, timeoutMs, now, sleep);

    const home = await request(`${baseUrl}/`);
    assertHtml(home, '/');
    assertNoHydration(home, '/');
    assert(home.body.includes('Jelementi'), 'Missing Jelementi home content.');

    const article = await request(`${baseUrl}${routes.articlePath}`);
    assertHtml(article, routes.articlePath);
    assertNoHydration(article, routes.articlePath);
    assert(article.body.includes(routes.articleTitle), 'Missing representative article title.');
    if (routes.richArticlePath !== undefined) {
      const rich =
        routes.richArticlePath === routes.articlePath
          ? article
          : await request(`${baseUrl}${routes.richArticlePath}`);
      assertHtml(rich, routes.richArticlePath);
      assert(rich.body.includes('Sources'), 'Missing Sources on rich article page.');
      assert(rich.body.includes('Footnotes'), 'Missing Footnotes on rich article page.');
    }

    const categories = await request(`${baseUrl}/categories`);
    assertHtml(categories, '/categories');
    assertNoHydration(categories, '/categories');
    assert(categories.body.includes('Categories'), 'Missing Categories directory content.');

    const category = await request(`${baseUrl}${routes.categoryPath}`);
    assertHtml(category, routes.categoryPath);
    assertNoHydration(category, routes.categoryPath);
    assert(category.body.includes(routes.categoryName), 'Missing category content.');

    const missingCategoryPath = '/categories/missing-worker-category';
    const missingCategory = await request(`${baseUrl}${missingCategoryPath}`);
    assert(
      missingCategory.status === 404,
      `Missing category must return HTTP 404, received ${missingCategory.status}.`,
    );
    assert(
      noindexPattern.test(missingCategory.body),
      'Missing global noindex meta tag on missing category.',
    );
    assertHydration(missingCategory, missingCategoryPath);
    assert(missingCategory.body.includes('Page not found'), 'Missing category recovery heading.');

    const search = await request(`${baseUrl}/search`);
    assertHtml(search, '/search');
    assertHydration(search, '/search');

    const searchQuery = await request(`${baseUrl}/search?query=tristan`);
    assertHtml(searchQuery, '/search?query=tristan');
    assertHydration(searchQuery, '/search?query=tristan');

    const about = await request(`${baseUrl}/about`);
    assertHtml(about, '/about');
    assertNoHydration(about, '/about');

    const asset = await request(`${baseUrl}${staticAssetPath}`);
    assert(asset.status >= 200 && asset.status < 300, `Static asset failed: ${staticAssetPath}.`);

    const missing = await request(`${baseUrl}/not-found`);
    assert(
      missing.status === 404,
      `Unknown path must return HTTP 404, received ${missing.status}.`,
    );
    assert(noindexPattern.test(missing.body), 'Missing global noindex meta tag on 404 fallback.');
    assert(
      clientEntryPattern.test(missing.body),
      'Missing fallback client bootstrap on 404 fallback.',
    );
    assert(missing.body.includes('Page not found'), 'Missing English Jelementi 404 copy.');
    assert(!missing.body.includes('http-equiv="refresh"'), '404 fallback must not redirect to /.');
  } finally {
    if (child !== undefined) {
      await reap(child, now, sleep, reapTermTimeoutMs, reapKillTimeoutMs);
    }
    await localConfig?.cleanup();
  }
}

async function readSourceFiles(directory: string, root = directory): Promise<WorkerSourceFile[]> {
  const sources: WorkerSourceFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sources.push(...(await readSourceFiles(path, root)));
    if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') ||
        entry.name.endsWith('.svelte') ||
        entry.name.endsWith('.js')) &&
      // Test files are never bundled into the Worker; their env fixtures may
      // legitimately name bindings (e.g. R2_MEDIA) without accessing them.
      !entry.name.endsWith('.test.ts')
    ) {
      sources.push({ path: relative(root, path), source: await readFile(path, 'utf8') });
    }
  }
  return sources;
}

async function loadRoutes(rootDir: string): Promise<WorkerRoutes> {
  const index = JSON.parse(
    await readFile(join(rootDir, 'generated/index.json'), 'utf8'),
  ) as GeneratedIndexEntry[];
  const first = index[0];
  if (first === undefined)
    throw new Error('Generated index has no published articles for Worker verification.');
  const rich = index.find((entry) => entry.slug === richContentSlug);
  return {
    articlePath: `/articles/${first.slug}`,
    categoryPath: `/categories/${first.categorySlug}`,
    articleTitle: first.title,
    categoryName: first.category,
    ...(rich === undefined ? {} : { richArticlePath: `/articles/${rich.slug}` }),
  };
}

async function findStaticAsset(rootDir: string): Promise<string> {
  const assetsRoot = join(rootDir, '.svelte-kit/cloudflare');
  const files = await readSourceFiles(assetsRoot);
  const entry = files.find(
    (file) => file.path.includes('_app/immutable/') && file.path.endsWith('.js'),
  );
  if (entry === undefined) throw new Error('Cloudflare output has no JavaScript static asset.');
  return `/${entry.path.replace(/\\/g, '/')}`;
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  assertNoR2MediaBinding(await readSourceFiles(join(rootDir, 'apps/web/src')));
  await verifyWorker({
    rootDir,
    routes: await loadRoutes(rootDir),
    staticAssetPath: await findStaticAsset(rootDir),
  });
  console.log('Local Worker smoke passed: /not-found returned HTTP 404 without redirect.');
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
