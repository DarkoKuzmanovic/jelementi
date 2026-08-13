import { stringify } from 'yaml';

/**
 * Public metadata shape accepted by {@link serializeArticleSource}. It mirrors
 * the frontmatter contract parsed by `compileArticle` so the compiler remains
 * the single validator of article source.
 */
export interface ArticleReferenceSource {
  title: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
}

export interface ArticleSourceFrontmatter {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt?: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
  category: string;
  tags: string[];
  author: string;
  cover: { src: string; alt: string };
  audio?: { src: string; durationSeconds?: number };
  references: ArticleReferenceSource[];
}

export interface ArticleSourceInput {
  frontmatter: ArticleSourceFrontmatter;
  body: string;
}

/**
 * Deterministic canonical article source:
 *
 * - `---` opening delimiter line;
 * - YAML frontmatter emitted in the locked field order `title, slug, excerpt,
 *   publishedAt?, updatedAt, status, category, tags, author, cover, audio?,
 *   references`, with stable YAML quoting chosen by the pinned `yaml` emitter
 *   (`lineWidth: 0` so scalars are never wrapped);
 * - `---` closing delimiter line followed by exactly one LF;
 * - the Markdown body with CRLF and lone CR line endings normalized to LF.
 *
 * The body is otherwise passed through verbatim: no trimming and no added or
 * removed trailing newline. Repeated calls with the same input produce
 * byte-identical output.
 */
export function serializeArticleSource({ frontmatter, body }: ArticleSourceInput): string {
  const yamlBlock = stringify(toYamlMapping(frontmatter), { lineWidth: 0 });
  return `---\n${yamlBlock}---\n${body.replace(/\r\n?/g, '\n')}`;
}

function toYamlMapping(frontmatter: ArticleSourceFrontmatter): Record<string, unknown> {
  return {
    title: frontmatter.title,
    slug: frontmatter.slug,
    excerpt: frontmatter.excerpt,
    ...(frontmatter.publishedAt === undefined ? {} : { publishedAt: frontmatter.publishedAt }),
    updatedAt: frontmatter.updatedAt,
    status: frontmatter.status,
    category: frontmatter.category,
    tags: frontmatter.tags,
    author: frontmatter.author,
    cover: { src: frontmatter.cover.src, alt: frontmatter.cover.alt },
    ...(frontmatter.audio === undefined
      ? {}
      : {
          audio: {
            src: frontmatter.audio.src,
            ...(frontmatter.audio.durationSeconds === undefined
              ? {}
              : { durationSeconds: frontmatter.audio.durationSeconds }),
          },
        }),
    references: frontmatter.references.map((reference) => ({
      title: reference.title,
      url: reference.url,
      ...(reference.publisher === undefined ? {} : { publisher: reference.publisher }),
      ...(reference.accessedAt === undefined ? {} : { accessedAt: reference.accessedAt }),
    })),
  };
}
