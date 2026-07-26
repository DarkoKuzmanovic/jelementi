import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredRoutes = [
  '/',
  '/articles/tristan-da-cunha',
  '/categories/history',
  '/search',
  '/about',
  '/404',
];
const hydratedRoutes = ['/search', '/404'];
const clientEntryPattern = /(?:\/_app\/immutable\/entry\/start|\bkit\.start\()/i;

export function verifyRenderedPages(pages: Readonly<Record<string, string>>): void {
  for (const route of requiredRoutes) {
    if (!pages[route]) throw new Error(`Missing prerendered route: ${route}.`);
  }
  for (const [route, html] of Object.entries(pages)) {
    if (!html.includes('<meta name="robots" content="noindex"')) {
      throw new Error(`Missing global noindex meta tag: ${route}.`);
    }
  }
  for (const route of hydratedRoutes) {
    if (!clientEntryPattern.test(pages[route] ?? '')) {
      throw new Error(`Missing intentional hydration client entry on: ${route}.`);
    }
  }
  for (const [route, html] of Object.entries(pages)) {
    if (hydratedRoutes.includes(route)) continue;
    if (clientEntryPattern.test(html)) {
      throw new Error(`Unexpected hydration client entry on reader route: ${route}.`);
    }
  }
  const article = pages['/articles/tristan-da-cunha'] ?? '';
  for (const text of [
    'A Rock at the Edge of the World',
    'Sources',
    'Footnotes',
    'Tristan da Cunha Government',
  ]) {
    if (!article.includes(text))
      throw new Error(`Missing representative article content: ${text}.`);
  }
}

async function readHtmlFiles(directory: string, root = directory): Promise<Record<string, string>> {
  const pages: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(pages, await readHtmlFiles(path, root));
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const outputPath = relative(root, path).replace(/\\/g, '/');
      const route =
        outputPath === 'index.html'
          ? '/'
          : `/${outputPath.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
      pages[route] = await readFile(path, 'utf8');
    }
  }
  return pages;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const pages = await readHtmlFiles(join(root, 'apps/web/build'));
  verifyRenderedPages(pages);
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
