import {
  ArticleDocumentSchema,
  normalizeSearchText,
  type ArticleBlock,
  type ArticleDocument,
  type ArticleFootnote,
  type InlineNode,
} from '@jelementi/article-model';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parseDocument } from 'yaml';
import type { ArticleSourceFrontmatter, ArticleSourceInput } from './article-source';

export interface CompileArticleInput {
  markdown: string;
  sourcePath: string;
  mediaBaseUrl: string;
}

export interface CompiledArticle {
  document: ArticleDocument;
  searchText: string;
}

export interface ContentCompileIssue {
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  column?: number;
}

export class ContentCompileError extends Error {
  readonly issues: ContentCompileIssue[];

  constructor(issues: ContentCompileIssue[]) {
    super(issues.map((issue) => `${issue.sourcePath}: ${issue.message}`).join('\n'));
    this.name = 'ContentCompileError';
    this.issues = issues;
  }
}

export { serializeArticleSource } from './article-source';
export type {
  ArticleReferenceSource,
  ArticleSourceFrontmatter,
  ArticleSourceInput,
} from './article-source';

interface AstNode {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  alt?: string;
  title?: string | null;
  identifier?: string;
  label?: string;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: AstNode[];
  position?: { start?: { line?: number; column?: number } };
}

type Frontmatter = ArticleSourceFrontmatter;

function raiseIssue(
  sourcePath: string,
  code: string,
  message: string,
  line?: number,
  column?: number,
): ContentCompileError {
  return new ContentCompileError([
    {
      code,
      message,
      sourcePath,
      line: line ?? 1,
      column: column ?? 1,
    },
  ]);
}

function issue(
  input: CompileArticleInput,
  code: string,
  message: string,
  node?: AstNode,
): ContentCompileError {
  return raiseIssue(
    input.sourcePath,
    code,
    message,
    node?.position?.start?.line,
    node?.position?.start?.column,
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim() !== '')
    ? value
    : undefined;
}

function parseFrontmatterYaml(raw: string, sourcePath: string): Record<string, unknown> {
  const yaml = parseDocument(raw);
  if (yaml.errors.length > 0) {
    const error = yaml.errors[0];
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      error?.message ?? 'Invalid YAML frontmatter.',
      error?.linePos?.[0]?.line,
      error?.linePos?.[0]?.col,
    );
  }
  const value: unknown = yaml.toJSON();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw raiseIssue(sourcePath, 'INVALID_FRONTMATTER', 'Frontmatter must be a YAML mapping.');
  }
  return value as Record<string, unknown>;
}

function frontmatterFromRecord(
  record: Record<string, unknown>,
  sourcePath: string,
): Frontmatter {
  const allowed = new Set([
    'title',
    'slug',
    'excerpt',
    'publishedAt',
    'updatedAt',
    'status',
    'category',
    'tags',
    'author',
    'cover',
    'audio',
    'references',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key))
      throw raiseIssue(
        sourcePath,
        'INVALID_FRONTMATTER',
        `Unsupported frontmatter field "${key}".`,
      );
  }
  const cover = record.cover;
  const references = record.references;
  const status = record.status;
  if (
    !asString(record.title) ||
    !asString(record.slug) ||
    !asString(record.excerpt) ||
    !asString(record.updatedAt) ||
    !asString(record.category) ||
    !asString(record.author) ||
    !asStringArray(record.tags) ||
    (status !== 'draft' && status !== 'published' && status !== 'archived') ||
    cover === null ||
    typeof cover !== 'object' ||
    Array.isArray(cover) ||
    !asString((cover as Record<string, unknown>).src) ||
    typeof (cover as Record<string, unknown>).alt !== 'string' ||
    !Array.isArray(references)
  ) {
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'Frontmatter is missing a required field or contains an invalid value.',
    );
  }
  const coverRecord = cover as Record<string, unknown>;
  for (const key of Object.keys(coverRecord)) {
    if (key !== 'src' && key !== 'alt')
      throw raiseIssue(sourcePath, 'INVALID_FRONTMATTER', `Unknown cover field "${key}".`);
  }
  if (record.publishedAt !== undefined && !asString(record.publishedAt)) {
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'publishedAt must be a non-empty string when present.',
    );
  }
  if (status === 'published' && !asString(record.publishedAt)) {
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'publishedAt is required for published articles.',
    );
  }
  const parsedReferences = references.map((reference) => {
    if (reference === null || typeof reference !== 'object' || Array.isArray(reference)) {
      throw raiseIssue(sourcePath, 'INVALID_FRONTMATTER', 'Each reference must be a mapping.');
    }
    const item = reference as Record<string, unknown>;
    if (!asString(item.title) || !asString(item.url)) {
      throw raiseIssue(sourcePath, 'INVALID_FRONTMATTER', 'Each reference requires title and url.');
    }
    const allowedRefKeys = new Set(['title', 'url', 'publisher', 'accessedAt']);
    for (const key of Object.keys(item)) {
      if (!allowedRefKeys.has(key))
        throw raiseIssue(
          sourcePath,
          'INVALID_FRONTMATTER',
          `Unknown reference field "${key}".`,
        );
    }
    if (item.publisher !== undefined && !asString(item.publisher)) {
      throw raiseIssue(
        sourcePath,
        'INVALID_FRONTMATTER',
        'reference.publisher must be a non-empty string when present.',
      );
    }
    if (item.accessedAt !== undefined && !asString(item.accessedAt)) {
      throw raiseIssue(
        sourcePath,
        'INVALID_FRONTMATTER',
        'reference.accessedAt must be a non-empty string when present.',
      );
    }
    return {
      title: item.title as string,
      url: item.url as string,
      ...(asString(item.publisher) ? { publisher: item.publisher as string } : {}),
      ...(asString(item.accessedAt) ? { accessedAt: item.accessedAt as string } : {}),
    };
  });
  const audio = record.audio;
  if (
    audio !== undefined &&
    (audio === null || typeof audio !== 'object' || Array.isArray(audio))
  ) {
    throw raiseIssue(sourcePath, 'INVALID_FRONTMATTER', 'audio must be a mapping.');
  }
  const audioRecord = audio as Record<string, unknown> | undefined;
  if (audioRecord !== undefined && !asString(audioRecord.src)) {
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'audio.src is required when audio is present.',
    );
  }
  if (
    audioRecord?.durationSeconds !== undefined &&
    (typeof audioRecord.durationSeconds !== 'number' ||
      !Number.isInteger(audioRecord.durationSeconds) ||
      audioRecord.durationSeconds < 1)
  ) {
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'audio.durationSeconds must be a positive integer.',
    );
  }
  if (audioRecord !== undefined) {
    for (const key of Object.keys(audioRecord)) {
      if (key !== 'src' && key !== 'durationSeconds')
        throw raiseIssue(
          sourcePath,
          'INVALID_FRONTMATTER',
          `Unknown audio field "${key}".`,
        );
    }
  }
  return {
    title: record.title as string,
    slug: record.slug as string,
    excerpt: record.excerpt as string,
    ...(asString(record.publishedAt) ? { publishedAt: record.publishedAt as string } : {}),
    updatedAt: record.updatedAt as string,
    status,
    category: record.category as string,
    tags: record.tags as string[],
    author: record.author as string,
    cover: {
      src: (cover as Record<string, unknown>).src as string,
      alt: (cover as Record<string, unknown>).alt as string,
    },
    ...(audioRecord
      ? {
          audio: {
            src: audioRecord.src as string,
            ...(audioRecord.durationSeconds === undefined
              ? {}
              : { durationSeconds: audioRecord.durationSeconds as number }),
          },
        }
      : {}),
    references: parsedReferences,
  };
}

function parseFrontmatter(input: CompileArticleInput): Frontmatter {
  const match = input.markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match?.[1])
    throw issue(
      input,
      'INVALID_FRONTMATTER',
      'Expected YAML frontmatter at the start of the file.',
    );
  const record = parseFrontmatterYaml(match[1], input.sourcePath);
  const frontmatter = frontmatterFromRecord(record, input.sourcePath);
  const stem = input.sourcePath.split('/').pop()?.replace(/\.md$/, '');
  if (stem !== frontmatter.slug)
    throw issue(
      input,
      'INVALID_FRONTMATTER',
      'Source filename must match frontmatter slug.',
    );
  return frontmatter;
}

/**
 * Decode canonical article source into editable frontmatter plus the exact
 * body bytes. This is the Studio-facing pure counterpart of
 * {@link serializeArticleSource}: it reuses the same compiler-owned
 * frontmatter validation as `compileArticle` so every accepted source decodes
 * deterministically and no Markdown ownership moves into Studio.
 *
 * The body is returned verbatim after the canonical closing delimiter,
 * including empty bodies and LF-normalized bytes of serialized sources.
 * Malformed delimiters, duplicate or unknown frontmatter keys, invalid field
 * shapes, and a slug that does not match the source filename are rejected with
 * a structured source-located {@link ContentCompileError}.
 */
export function parseArticleSource(markdown: string, sourcePath: string): ArticleSourceInput {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match?.[1])
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'Expected YAML frontmatter at the start of the file.',
    );
  const record = parseFrontmatterYaml(match[1], sourcePath);
  const frontmatter = frontmatterFromRecord(record, sourcePath);
  const stem = sourcePath.split('/').pop()?.replace(/\.md$/, '');
  if (stem !== frontmatter.slug)
    throw raiseIssue(
      sourcePath,
      'INVALID_FRONTMATTER',
      'Source filename must match frontmatter slug.',
    );
  return { frontmatter, body: match[2] ?? '' };
}

function resolveMedia(input: CompileArticleInput, key: string, node?: AstNode): string {
  // Reject backslashes — WHATWG URL treats them as path separators.
  if (key.includes('\\')) {
    throw issue(input, 'INVALID_MEDIA', 'Media keys must not contain backslashes.', node);
  }
  // Reject percent-encoded path/dot separators that bypass segment checks.
  if (/%2e/i.test(key) || /%2f/i.test(key) || /%5c/i.test(key)) {
    throw issue(
      input,
      'INVALID_MEDIA',
      'Media keys must not contain percent-encoded path separators.',
      node,
    );
  }
  if (
    key.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(key) ||
    key.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')
  ) {
    throw issue(
      input,
      'INVALID_MEDIA',
      'Media keys must be non-empty relative paths without dot segments.',
      node,
    );
  }
  let base: URL;
  try {
    base = new URL(
      input.mediaBaseUrl.endsWith('/') ? input.mediaBaseUrl : `${input.mediaBaseUrl}/`,
    );
  } catch {
    throw issue(input, 'INVALID_MEDIA', 'mediaBaseUrl must be an absolute URL.', node);
  }
  const isLoopback =
    base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '[::1]';
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && isLoopback)) {
    throw issue(input, 'INVALID_MEDIA', 'mediaBaseUrl must use HTTPS, except loopback HTTP.', node);
  }
  const resolved = new URL(key, base);
  // Containment: resolved URL must stay under the base origin and pathname.
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) {
    throw issue(input, 'INVALID_MEDIA', 'Media key resolves outside the media base URL.', node);
  }
  return resolved.toString();
}

function appendMarks(
  nodes: InlineNode[],
  mark: 'strong' | 'emphasis' | 'strikethrough',
): InlineNode[] {
  return nodes.map((node) =>
    node.type === 'text'
      ? { ...node, marks: [...(node.marks ?? []), mark] }
      : node.type === 'link'
        ? { ...node, children: appendMarks(node.children, mark) }
        : node,
  );
}

function inlineNodes(input: CompileArticleInput, nodes: AstNode[] | undefined): InlineNode[] {
  if (!nodes) return [];
  const output: InlineNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        if (/\[\^[^\]]+\]/.test(node.value ?? '')) {
          throw issue(input, 'INVALID_FOOTNOTE', 'Footnote reference has no definition.', node);
        }
        output.push({ type: 'text', value: node.value ?? '' });
        break;
      case 'strong':
        output.push(...appendMarks(inlineNodes(input, node.children), 'strong'));
        break;
      case 'emphasis':
        output.push(...appendMarks(inlineNodes(input, node.children), 'emphasis'));
        break;
      case 'delete':
        output.push(...appendMarks(inlineNodes(input, node.children), 'strikethrough'));
        break;
      case 'inlineCode':
        output.push({ type: 'text', value: node.value ?? '', marks: ['code'] });
        break;
      case 'link':
        if (!node.url?.startsWith('https://'))
          throw issue(input, 'UNSUPPORTED_NODE', 'Links must use HTTPS URLs.', node);
        output.push({ type: 'link', href: node.url, children: inlineNodes(input, node.children) });
        break;
      case 'footnoteReference':
        if (!node.identifier)
          throw issue(input, 'INVALID_FOOTNOTE', 'Footnote reference has no identifier.', node);
        output.push({ type: 'footnoteReference', id: node.identifier });
        break;
      default:
        throw issue(
          input,
          node.type === 'image' ? 'UNSUPPORTED_NODE' : 'UNSUPPORTED_NODE',
          `Unsupported inline node "${node.type}".`,
          node,
        );
    }
  }
  return output;
}

function visibleText(nodes: InlineNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' ? node.value : node.type === 'link' ? visibleText(node.children) : '',
    )
    .join(' ');
}

function headingId(nodes: InlineNode[], seen: Map<string, number>): string {
  const base =
    visibleText(nodes)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function quoteBlock(input: CompileArticleInput, node: AstNode): ArticleBlock {
  if (node.children?.length !== 1 || node.children[0]?.type !== 'paragraph') {
    throw issue(input, 'UNSUPPORTED_NODE', 'Quotes may contain exactly one paragraph.', node);
  }
  const children = inlineNodes(input, node.children[0].children);
  const last = children.at(-1);
  if (last?.type === 'text') {
    const match = last.value.match(/^(.*?)(?:\r?\n)—\s+([^\r\n]+)$/s);
    if (match?.[1]?.trim() && match[2]?.trim()) {
      const next = children.slice(0, -1);
      next.push({ ...last, value: match[1] });
      return { type: 'quote', children: next, attribution: match[2].trim() };
    }
  }
  if (children.length === 0)
    throw issue(input, 'UNSUPPORTED_NODE', 'Quotes may not be empty.', node);
  return { type: 'quote', children };
}

function listBlock(input: CompileArticleInput, node: AstNode): ArticleBlock {
  if (node.ordered && node.start !== null && node.start !== undefined && node.start !== 1) {
    throw issue(input, 'INVALID_LIST', 'Ordered lists must start at 1.', node);
  }
  const items = (node.children ?? []).map((item) => {
    if (
      item.type !== 'listItem' ||
      (item.checked !== null && item.checked !== undefined) ||
      item.children?.length !== 1 ||
      item.children[0]?.type !== 'paragraph'
    ) {
      throw issue(
        input,
        'INVALID_LIST',
        'Lists must be flat, non-task items with one paragraph each.',
        item,
      );
    }
    return inlineNodes(input, item.children[0].children);
  });
  if (items.length === 0)
    throw issue(input, 'INVALID_LIST', 'Lists must contain at least one item.', node);
  return { type: 'list', ordered: node.ordered === true, items };
}

function calloutBlock(input: CompileArticleInput, node: AstNode): ArticleBlock {
  if (node.name !== 'fact' && node.name !== 'note' && node.name !== 'warning') {
    throw issue(input, 'INVALID_DIRECTIVE', `Unsupported directive "${node.name ?? ''}".`, node);
  }
  const attributes = node.attributes ?? {};
  if (Object.keys(attributes).some((key) => key !== 'title') || attributes.title === null) {
    throw issue(
      input,
      'INVALID_DIRECTIVE',
      'Callouts support only an optional string title attribute.',
      node,
    );
  }
  if (node.children?.length !== 1 || node.children[0]?.type !== 'paragraph') {
    throw issue(input, 'INVALID_DIRECTIVE', 'Callouts may contain exactly one paragraph.', node);
  }
  const children = inlineNodes(input, node.children[0].children);
  if (children.length === 0)
    throw issue(input, 'INVALID_DIRECTIVE', 'Callouts may not be empty.', node);
  return {
    type: 'callout',
    variant: node.name,
    ...(attributes.title === undefined ? {} : { title: attributes.title }),
    children,
  };
}

function parseAst(input: CompileArticleInput): AstNode[] {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(input.markdown).children as AstNode[];
}

export function compileArticle(input: CompileArticleInput): CompiledArticle {
  const frontmatter = parseFrontmatter(input);
  const ast = parseAst(input);
  const blocks: ArticleBlock[] = [];
  const footnotes: ArticleFootnote[] = [];
  const footnoteIds = new Set<string>();
  const headings = new Map<string, number>();
  for (const node of ast) {
    if (node.type === 'yaml') continue;
    if (node.type === 'footnoteDefinition') {
      if (
        !node.identifier ||
        node.children?.length !== 1 ||
        node.children[0]?.type !== 'paragraph'
      ) {
        throw issue(
          input,
          'INVALID_FOOTNOTE',
          'Footnotes may contain exactly one paragraph.',
          node,
        );
      }
      if (footnoteIds.has(node.identifier)) {
        throw issue(input, 'INVALID_FOOTNOTE', 'Footnote definitions must be unique.', node);
      }
      footnoteIds.add(node.identifier);
      footnotes.push({
        id: node.identifier,
        children: inlineNodes(input, node.children[0].children),
      });
      continue;
    }
    switch (node.type) {
      case 'paragraph': {
        const children = node.children ?? [];
        if (children.length === 1 && children[0]?.type === 'image') {
          const image = children[0];
          if (!image.url || image.alt === undefined)
            throw issue(input, 'INVALID_MEDIA', 'Images require a source and alt text.', image);
          blocks.push({
            type: 'image',
            src: resolveMedia(input, image.url, image),
            alt: image.alt,
            ...(image.title ? { caption: [{ type: 'text', value: image.title }] } : {}),
          });
        } else {
          blocks.push({ type: 'paragraph', children: inlineNodes(input, children) });
        }
        break;
      }
      case 'heading': {
        if (node.depth !== 2 && node.depth !== 3 && node.depth !== 4) {
          throw issue(
            input,
            'UNSUPPORTED_NODE',
            'Only level 2 through 4 headings are supported.',
            node,
          );
        }
        const children = inlineNodes(input, node.children);
        blocks.push({
          type: 'heading',
          level: node.depth,
          id: headingId(children, headings),
          children,
        });
        break;
      }
      case 'image':
        throw issue(
          input,
          'UNSUPPORTED_NODE',
          'Images must be the only content in a paragraph.',
          node,
        );
      case 'list':
        blocks.push(listBlock(input, node));
        break;
      case 'blockquote':
        blocks.push(quoteBlock(input, node));
        break;
      case 'thematicBreak':
        blocks.push({ type: 'divider' });
        break;
      case 'containerDirective':
        blocks.push(calloutBlock(input, node));
        break;
      default:
        throw issue(input, 'UNSUPPORTED_NODE', `Unsupported Markdown node "${node.type}".`, node);
    }
  }
  const bodyText = [
    ...blocks.flatMap((block) => {
      if (block.type === 'divider' || block.type === 'image')
        return block.type === 'image' && block.caption ? [visibleText(block.caption)] : [];
      if (block.type === 'list') return block.items.map(visibleText);
      return [visibleText(block.children)];
    }),
    ...footnotes.map((footnote) => visibleText(footnote.children)),
  ].join(' ');
  const wordCount = bodyText.trim() === '' ? 0 : bodyText.trim().split(/\s+/).length;
  const documentInput = {
    schemaVersion: 1,
    ...frontmatter,
    cover: { ...frontmatter.cover, src: resolveMedia(input, frontmatter.cover.src) },
    ...(frontmatter.audio
      ? { audio: { ...frontmatter.audio, src: resolveMedia(input, frontmatter.audio.src) } }
      : {}),
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    blocks,
    footnotes,
  };
  const validated = ArticleDocumentSchema.safeParse(documentInput);
  if (!validated.success) {
    throw issue(
      input,
      'FINAL_VALIDATION',
      validated.error.issues[0]?.message ?? 'Article model validation failed.',
    );
  }
  const searchText = normalizeSearchText(
    [
      frontmatter.title,
      frontmatter.excerpt,
      frontmatter.category,
      ...frontmatter.tags,
      frontmatter.author,
      bodyText,
    ].join(' '),
  );
  return { document: validated.data, searchText };
}
