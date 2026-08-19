import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const READER_ASSET_BUDGETS = {
  routes: {
    home: { baseline: 1_328, ceiling: 9_520 },
    about: { baseline: 1_127, ceiling: 9_319 },
    category: { baseline: 1_171, ceiling: 9_363 },
    article: { baseline: 5_011, ceiling: 13_203 },
    search: { baseline: 3_623, ceiling: 11_815 },
    notFound: { baseline: 1_281, ceiling: 9_473 },
    categories: { baseline: 0, ceiling: 8_192 },
  },
  representativeHtml: 70_885,
  uniqueReaderCss: 17_943,
  searchJavaScript: 167_513,
  // Raw generated JSON bytes from the same main@261cb6a canonical build.
  // This reports content-artifact growth separately; it never raises any
  // production HTML/CSS/JS implementation ceiling.
  generatedContentBaseline: 6_131,
} as const;

export type ReaderRouteClass = keyof typeof READER_ASSET_BUDGETS.routes;

export interface ReaderAssetMeasurement {
  routes: Record<ReaderRouteClass, number | null>;
  representativeHtmlBytes: number;
  uniqueReaderCssBytes: number;
  searchJavaScriptBytes: number;
  generatedContentBytes: number;
  contentOnlyGrowthBytes: number;
}

export interface ReaderAssetInput {
  pages: Readonly<Record<string, string>>;
  assets: Readonly<Record<string, string | Uint8Array>>;
  representative: { article: string; category: string };
  generatedContentBytes: number;
}

function rawBytes(value: string | Uint8Array): number {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.byteLength;
}

function assetPath(reference: string, route: string): string {
  // Prerendered routes are emitted as extensionless documents (`about.html`,
  // `articles/slug.html`), so relative references resolve from the route's
  // parent just as they do in the browser. Appending a slash would instead
  // treat every route as a directory and over-nest `./_app/*` references.
  const url = new URL(reference, `https://reader-assets.invalid${route}`);
  return url.pathname;
}

function tagAttributes(source: string, tagName: 'link' | 'script'): Array<Record<string, string>> {
  const tags = source.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  return tags.map((tag) => {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
      const name = match[1];
      const value = match[2];
      if (name !== undefined && value !== undefined) attributes[name.toLowerCase()] = value;
    }
    return attributes;
  });
}

function referencedStylesheets(source: string, route: string): string[] {
  return tagAttributes(source, 'link')
    .filter((attributes) => attributes.rel?.toLowerCase() === 'stylesheet')
    .flatMap((attributes) =>
      attributes.href === undefined ? [] : [assetPath(attributes.href, route)],
    );
}

function referencedSearchJavaScript(source: string, route: string): string[] {
  const preload = tagAttributes(source, 'link')
    .filter((attributes) => attributes.rel?.toLowerCase() === 'modulepreload')
    .flatMap((attributes) =>
      attributes.href === undefined ? [] : [assetPath(attributes.href, route)],
    );
  const scripts = tagAttributes(source, 'script').flatMap((attributes) =>
    attributes.src === undefined ? [] : [assetPath(attributes.src, route)],
  );
  return [...preload, ...scripts];
}

function requiredPage(pages: Readonly<Record<string, string>>, route: string): string {
  const page = pages[route];
  if (page === undefined) throw new Error(`Missing representative Reader HTML route: ${route}.`);
  return page;
}

function totalReferencedAssets(
  paths: Iterable<string>,
  assets: Readonly<Record<string, string | Uint8Array>>,
): number {
  let total = 0;
  for (const path of new Set(paths)) {
    const asset = assets[path];
    if (asset === undefined)
      throw new Error(`Missing referenced asset in production output: ${path}.`);
    total += rawBytes(asset);
  }
  return total;
}

export function measureReaderAssets({
  pages,
  assets,
  representative,
  generatedContentBytes,
}: ReaderAssetInput): ReaderAssetMeasurement {
  const routePaths: Record<ReaderRouteClass, string> = {
    home: '/',
    about: '/about',
    category: representative.category,
    article: representative.article,
    search: '/search',
    notFound: '/404',
    categories: '/categories',
  };

  const routes = Object.fromEntries(
    Object.entries(routePaths).map(([routeClass, route]) => {
      const page = pages[route];
      if (routeClass !== 'categories' && page === undefined) requiredPage(pages, route);
      return [routeClass, page === undefined ? null : Buffer.byteLength(page, 'utf8')];
    }),
  ) as Record<ReaderRouteClass, number | null>;

  const representativePages = Object.values(routePaths).flatMap((route) => {
    const page = pages[route];
    return page === undefined ? [] : [{ route, page }];
  });
  const cssPaths = representativePages.flatMap(({ route, page }) =>
    referencedStylesheets(page, route),
  );
  const searchPage = requiredPage(pages, '/search');

  return {
    routes,
    representativeHtmlBytes: Object.values(routes).reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    ),
    uniqueReaderCssBytes: totalReferencedAssets(cssPaths, assets),
    searchJavaScriptBytes: totalReferencedAssets(
      referencedSearchJavaScript(searchPage, '/search'),
      assets,
    ),
    generatedContentBytes,
    contentOnlyGrowthBytes: generatedContentBytes - READER_ASSET_BUDGETS.generatedContentBaseline,
  };
}

export function assertReaderAssetBudgets(measurement: ReaderAssetMeasurement): void {
  for (const [routeClass, budget] of Object.entries(READER_ASSET_BUDGETS.routes) as Array<
    [ReaderRouteClass, { baseline: number; ceiling: number }]
  >) {
    const measured = measurement.routes[routeClass];
    if (measured !== null && measured > budget.ceiling) {
      throw new Error(
        `Reader ${routeClass} HTML is ${measured} raw bytes; frozen ceiling is ${budget.ceiling}.`,
      );
    }
  }
  if (measurement.representativeHtmlBytes > READER_ASSET_BUDGETS.representativeHtml) {
    throw new Error(
      `Reader representative HTML is ${measurement.representativeHtmlBytes} raw bytes; frozen ceiling is ${READER_ASSET_BUDGETS.representativeHtml}.`,
    );
  }
  if (measurement.uniqueReaderCssBytes > READER_ASSET_BUDGETS.uniqueReaderCss) {
    throw new Error(
      `Unique Reader CSS is ${measurement.uniqueReaderCssBytes} raw bytes; frozen ceiling is ${READER_ASSET_BUDGETS.uniqueReaderCss}.`,
    );
  }
  if (measurement.searchJavaScriptBytes > READER_ASSET_BUDGETS.searchJavaScript) {
    throw new Error(
      `Search JavaScript is ${measurement.searchJavaScriptBytes} raw bytes; frozen ceiling is ${READER_ASSET_BUDGETS.searchJavaScript}.`,
    );
  }
}

async function readTree(
  directory: string,
  predicate: (path: string) => boolean,
  root = directory,
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await readTree(path, predicate, root));
    if (entry.isFile() && predicate(path)) {
      files[`/${relative(root, path).replace(/\\/g, '/')}`] = await readFile(path);
    }
  }
  return files;
}

function outputPathToRoute(path: string): string {
  const outputPath = path.replace(/^\//, '');
  return outputPath === 'index.html'
    ? '/'
    : `/${outputPath.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

async function loadProductionInput(root: string): Promise<ReaderAssetInput> {
  const outputRoot = join(root, '.svelte-kit/cloudflare');
  const rawOutput = await readTree(outputRoot, () => true);
  const pages: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(rawOutput)) {
    if (path.endsWith('.html'))
      pages[outputPathToRoute(path)] = Buffer.from(bytes).toString('utf8');
    else assets[path] = bytes;
  }

  const generatedFiles = await readTree(join(root, 'generated'), (path) => path.endsWith('.json'));
  const generatedContentBytes = Object.values(generatedFiles).reduce(
    (total, bytes) => total + bytes.byteLength,
    0,
  );
  const index = JSON.parse(await readFile(join(root, 'generated/index.json'), 'utf8')) as Array<{
    slug?: unknown;
    categorySlug?: unknown;
  }>;
  const first = index[0];
  if (typeof first?.slug !== 'string' || typeof first.categorySlug !== 'string') {
    throw new Error('Generated index has no representative published article.');
  }

  return {
    pages,
    assets,
    representative: {
      article: `/articles/${first.slug}`,
      category: `/categories/${first.categorySlug}`,
    },
    generatedContentBytes,
  };
}

async function main(): Promise<void> {
  const measurement = measureReaderAssets(await loadProductionInput(process.cwd()));
  assertReaderAssetBudgets(measurement);
  console.log(JSON.stringify(measurement, null, 2));
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
