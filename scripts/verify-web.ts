import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseRoutes = ['/', '/search', '/about', '/404'];
const hydratedRoutes = ['/search', '/404'];
const clientEntryPattern = /(?:\/_app\/immutable\/entry\/start|\bkit\.start\(\))/i;

export interface ClientBundleFile {
  path: string;
  source: string;
}

const forbiddenClientCapabilities = [
  { name: 'GitHub client', pattern: /api\.github\.com|github\.com\/graphql|\boctokit\b/i },
  {
    name: 'private key',
    pattern: /GITHUB_APP_PRIVATE_KEY|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  },
  {
    name: 'Access secret',
    pattern: /Cf-Access-Jwt-Assertion|ACCESS_AUD|ACCESS_TEAM_DOMAIN|ALLOWED_OPERATOR_EMAIL/i,
  },
  {
    name: 'content compiler dependency',
    pattern: /@jelementi\/content-compiler|\bContentCompileError\b|\bcompileArticle\b/,
  },
  {
    name: 'Studio server module',
    pattern: /(?:^|[\/.])server\/studio(?:[\/.]|$)|github-adapter|access-auth\.server/i,
  },
] as const;

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

/** The seeded fixture article known to exercise sources and footnotes. */
export const richContentSlug = 'tristan-da-cunha';

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
  if (expectations.articles.length === 0)
    throw new Error('Generated content has no published article expectations.');
  for (const { slug, title } of expectations.articles) {
    if (!(pages[`/articles/${slug}`] ?? '').includes(title))
      throw new Error(`Missing article title on /articles/${slug}.`);
  }
  // The rich-render smoke check (sources + footnotes sections) is pinned to
  // the known rich fixture article. The newest article is whatever the
  // operator last published and may legally have no references or footnotes
  // (#47) — its coverage is the title check above.
  const rich = expectations.articles.find((article) => article.slug === richContentSlug);
  if (rich !== undefined) {
    const article = pages[`/articles/${rich.slug}`] ?? '';
    for (const text of ['Sources', 'Footnotes']) {
      if (!article.includes(text))
        throw new Error(`Missing representative article content: ${text}.`);
    }
  }
}

export function verifyPublicClientBundles(files: readonly ClientBundleFile[]): void {
  for (const file of files) {
    for (const capability of forbiddenClientCapabilities) {
      if (capability.pattern.test(file.source)) {
        throw new Error(`Public client bundle contains ${capability.name}: ${file.path}.`);
      }
    }
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

async function readClientBundles(directory: string, root = directory): Promise<ClientBundleFile[]> {
  const files: ClientBundleFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await readClientBundles(path, root)));
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push({
        path: relative(root, path).replace(/\\/g, '/'),
        source: await readFile(path, 'utf8'),
      });
    }
  }
  return files;
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
  const outputRoot = join(root, '.svelte-kit/cloudflare');
  const pages = await readHtmlFiles(outputRoot);
  verifyRenderedPages(pages, await loadExpectations(root));
  verifyPublicClientBundles(await readClientBundles(join(outputRoot, '_app/immutable')));
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
