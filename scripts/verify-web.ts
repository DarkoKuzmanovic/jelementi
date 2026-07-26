import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseRoutes = ['/', '/search', '/about', '/404'];
const hydratedRoutes = ['/search', '/404'];
const clientEntryPattern = /(?:\/_app\/immutable\/entry\/start|\bkit\.start\(\))/i;

export interface RenderedArticleExpectation {
  slug: string;
  title: string;
}

export interface RenderedPageExpectations {
  articles: readonly RenderedArticleExpectation[];
  categories: readonly string[];
}

interface GeneratedIndexEntry extends RenderedArticleExpectation {
  categorySlug: string;
}

const fixtureExpectations: RenderedPageExpectations = {
  articles: [{ slug: 'tristan-da-cunha', title: 'A Rock at the Edge of the World' }],
  categories: ['history'],
};

function requiredRoutes(expectations: RenderedPageExpectations): string[] {
  return [
    ...baseRoutes,
    ...expectations.articles.map((article) => `/articles/${article.slug}`),
    ...expectations.categories.map((category) => `/categories/${category}`),
  ];
}

export function verifyRenderedPages(
  pages: Readonly<Record<string, string>>,
  expectations: RenderedPageExpectations = fixtureExpectations,
): void {
  for (const route of requiredRoutes(expectations)) {
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
  const representative = expectations.articles[0];
  if (representative === undefined)
    throw new Error('Generated content has no published article expectations.');
  const article = pages[`/articles/${representative.slug}`] ?? '';
  for (const text of [representative.title, 'Sources', 'Footnotes']) {
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

async function loadExpectations(root: string): Promise<RenderedPageExpectations> {
  const index = JSON.parse(
    await readFile(join(root, 'generated/index.json'), 'utf8'),
  ) as GeneratedIndexEntry[];
  return {
    articles: index.map(({ slug, title }) => ({ slug, title })),
    categories: [...new Set(index.map((article) => article.categorySlug))],
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const pages = await readHtmlFiles(join(root, '.svelte-kit/cloudflare'));
  verifyRenderedPages(pages, await loadExpectations(root));
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
