import { randomUUID } from 'node:crypto';
import { existsSync, watch as watchDirectory } from 'node:fs';
import { readdir, readFile, rename, rm, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ArticleIndexSchema, categorySlug, type ArticleIndexEntry } from '@jelementi/article-model';
import {
  ContentCompileError,
  compileArticle,
  type CompiledArticle,
  type ContentCompileIssue,
} from '@jelementi/content-compiler';

export interface ContentPaths {
  rootDir: string;
  mediaBaseUrl: string;
}

export interface CompiledSource {
  sourcePath: string;
  compiled: CompiledArticle;
}

export interface ContentBatch {
  all: CompiledSource[];
  published: CompiledSource[];
  index: ArticleIndexEntry[];
}

export class ContentGenerationError extends Error {
  readonly issues: ContentCompileIssue[];

  constructor(message: string, sourcePath = 'content/articles') {
    super(message);
    this.name = 'ContentGenerationError';
    this.issues = [{ code: 'CONTENT_GENERATION', message, sourcePath }];
  }
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function issue(message: string, sourcePath?: string): ContentGenerationError {
  return new ContentGenerationError(message, sourcePath);
}

async function discoverArticlePaths(rootDir: string): Promise<string[]> {
  const articlesDir = join(rootDir, 'content/articles');
  try {
    return (await readdir(articlesDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => join(articlesDir, entry.name))
      .sort(comparePaths);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw issue('No content/articles directory found.', articlesDir);
    }
    throw error;
  }
}

async function compileSources(paths: ContentPaths): Promise<CompiledSource[]> {
  const articlePaths = await discoverArticlePaths(paths.rootDir);
  if (articlePaths.length === 0) {
    throw issue(
      'No Markdown source files found in content/articles.',
      join(paths.rootDir, 'content/articles'),
    );
  }
  const compiled: CompiledSource[] = [];
  for (const filePath of articlePaths) {
    const sourcePath = relative(paths.rootDir, filePath).replaceAll('\\', '/');
    const markdown = await readFile(filePath, 'utf8');
    compiled.push({
      sourcePath,
      compiled: compileArticle({ markdown, sourcePath, mediaBaseUrl: paths.mediaBaseUrl }),
    });
  }
  return compiled;
}

function createIndexEntry({ document, searchText }: CompiledArticle): ArticleIndexEntry {
  if (!document.publishedAt) throw issue('Published articles require publishedAt.');
  const slug = categorySlug(document.category);
  if (slug === '') throw issue('A non-empty category must produce a usable category slug.');
  return {
    slug: document.slug,
    title: document.title,
    excerpt: document.excerpt,
    publishedAt: document.publishedAt,
    updatedAt: document.updatedAt,
    category: document.category,
    categorySlug: slug,
    tags: document.tags,
    author: document.author,
    cover: document.cover,
    readingTimeMinutes: document.readingTimeMinutes,
    searchText,
  };
}

export function validateCompiledBatch(compiledSources: CompiledSource[]): ContentBatch {
  const seenSlugs = new Set<string>();
  const categoryNames = new Map<string, string>();
  for (const { sourcePath, compiled } of compiledSources) {
    const { document } = compiled;
    if (seenSlugs.has(document.slug)) {
      throw issue(`Duplicate slug "${document.slug}".`, sourcePath);
    }
    seenSlugs.add(document.slug);
    const normalizedCategory = categorySlug(document.category);
    if (normalizedCategory === '') {
      throw issue('A non-empty category must produce a usable category slug.', sourcePath);
    }
    const existingCategory = categoryNames.get(normalizedCategory);
    if (existingCategory !== undefined && existingCategory !== document.category) {
      throw issue(
        `Distinct category names "${existingCategory}" and "${document.category}" share category slug "${normalizedCategory}".`,
        sourcePath,
      );
    }
    categoryNames.set(normalizedCategory, document.category);
  }

  const published = compiledSources.filter(
    ({ compiled }) => compiled.document.status === 'published',
  );
  const index = published
    .map(({ compiled }) => createIndexEntry(compiled))
    .sort((left, right) => {
      const dateOrder = Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
      return dateOrder === 0 ? comparePaths(left.slug, right.slug) : dateOrder;
    });
  const validatedIndex = ArticleIndexSchema.safeParse(index);
  if (!validatedIndex.success) {
    throw issue(
      `Generated index is invalid: ${validatedIndex.error.issues[0]?.message ?? 'unknown error'}.`,
    );
  }
  return { all: compiledSources, published, index: validatedIndex.data };
}

export async function validateContent(paths: ContentPaths): Promise<ContentBatch> {
  return validateCompiledBatch(await compileSources(paths));
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export interface BuildContentOptions extends ContentPaths {
  renameDirectory?: (from: string, to: string) => Promise<void>;
}

async function replaceGeneratedDirectory(
  temporaryDir: string,
  generatedDir: string,
  renameDirectory: (from: string, to: string) => Promise<void>,
): Promise<void> {
  const backupDir = `${generatedDir}.backup-${randomUUID()}`;
  let movedPrevious = false;
  let installed = false;
  try {
    if (await pathExists(generatedDir)) {
      await renameDirectory(generatedDir, backupDir);
      movedPrevious = true;
    }
    await renameDirectory(temporaryDir, generatedDir);
    installed = true;
  } catch (error) {
    if (movedPrevious) {
      try {
        await renameDirectory(backupDir, generatedDir);
        movedPrevious = false;
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'Generated output replacement and restore failed.',
        );
      }
    }
    throw error;
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
    if (installed || !movedPrevious) await rm(backupDir, { recursive: true, force: true });
  }
}

export async function buildContent(options: BuildContentOptions): Promise<ContentBatch> {
  const batch = await validateContent(options);
  const generatedDir = join(options.rootDir, 'generated');
  const temporaryDir = `${generatedDir}.tmp-${randomUUID()}`;
  try {
    await mkdir(join(temporaryDir, 'articles'), { recursive: true });
    await Promise.all(
      batch.published.map(({ compiled }) =>
        writeFile(
          join(temporaryDir, 'articles', `${compiled.document.slug}.json`),
          stableJson(compiled.document),
        ),
      ),
    );
    await writeFile(join(temporaryDir, 'index.json'), stableJson(batch.index));
    await replaceGeneratedDirectory(temporaryDir, generatedDir, options.renameDirectory ?? rename);
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return batch;
}

export interface MediaBaseUrlOptions {
  rootDir: string;
  env?: NodeJS.ProcessEnv;
  loadEnvFile?: (path: string) => void;
}

export function loadMediaBaseUrl({
  rootDir,
  env = process.env,
  loadEnvFile = process.loadEnvFile,
}: MediaBaseUrlOptions): string {
  const envPath = join(rootDir, '.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
  const mediaBaseUrl = env.PUBLIC_MEDIA_BASE_URL?.trim();
  if (!mediaBaseUrl) throw issue('PUBLIC_MEDIA_BASE_URL is required.', '.env');
  return mediaBaseUrl;
}

export function formatContentError(error: unknown): string {
  const issues =
    error instanceof ContentCompileError || error instanceof ContentGenerationError
      ? error.issues
      : undefined;
  if (!issues) return error instanceof Error ? error.message : 'Unknown content error.';
  return issues
    .map((contentIssue) => {
      const location =
        contentIssue.line === undefined
          ? contentIssue.sourcePath
          : `${contentIssue.sourcePath}:${contentIssue.line}:${contentIssue.column ?? 1}`;
      return `${location}: ${contentIssue.message}`;
    })
    .join('\n');
}

export interface WatchHandle {
  close(): void;
}

export interface WatchContentOptions extends BuildContentOptions {
  onError?: (error: unknown) => void;
  watchDirectory?: (path: string, listener: () => void) => WatchHandle;
  debounce?: (callback: () => Promise<void>) => (() => void) & { cancel(): void };
  build?: (options: BuildContentOptions) => Promise<ContentBatch>;
}

export function defaultDebounce(callback: () => Promise<void>): (() => void) & { cancel(): void } {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const trigger = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = undefined;
      void callback();
    }, 100);
  };
  trigger.cancel = () => {
    if (timeout !== undefined) clearTimeout(timeout);
  };
  return trigger;
}

export async function watchContent(options: WatchContentOptions): Promise<WatchHandle> {
  const reportError = options.onError ?? (() => undefined);
  const build = options.build ?? buildContent;
  let running = false;
  let trailing = false;
  let closed = false;

  const runBuild = async () => {
    if (running) {
      trailing = true;
      return;
    }
    running = true;
    do {
      trailing = false;
      if (closed) break;
      try {
        await build(options);
      } catch (error) {
        reportError(error);
      }
    } while (trailing && !closed);
    running = false;
  };

  const trigger = (options.debounce ?? defaultDebounce)(runBuild);
  const watcher = (options.watchDirectory ?? ((path, listener) => watchDirectory(path, listener)))(
    join(options.rootDir, 'content/articles'),
    trigger,
  );
  await runBuild();
  return {
    close() {
      closed = true;
      trigger.cancel();
      watcher.close();
    },
  };
}
