import type { ArticleBlock, ArticleDocument, InlineNode } from '@jelementi/article-model';
import { assertExhaustiveBlock } from './exhaustive';

export interface ArticleHtmlOptions {
  /** Absolute origin used to make root-relative links work outside the site. */
  siteOrigin: string;
  /** False for e-books: remote images do not load offline, so only alt text/captions remain. */
  images: boolean;
}

/** Escapes text and attribute values for HTML and XHTML alike. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text of inline content: link text kept, footnote markers dropped. */
export function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' ? node.value : node.type === 'link' ? inlineText(node.children) : '',
    )
    .join('');
}

const markTags = { strong: 'strong', emphasis: 'em', code: 'code', strikethrough: 'del' } as const;

/**
 * Self-contained, well-formed (XHTML-compatible) article markup for feed
 * readers and e-books. The Svelte renderer stays the only on-site renderer.
 */
export function articleHtml(article: ArticleDocument, options: ArticleHtmlOptions): string {
  const footnoteNumbers = new Map(article.footnotes.map((note, index) => [note.id, index + 1]));
  const href = (value: string) =>
    escapeHtml(value.startsWith('/') ? `${options.siteOrigin}${value}` : value);

  const inline = (nodes: readonly InlineNode[]): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') {
          return (node.marks ?? []).reduce(
            (html, mark) => `<${markTags[mark]}>${html}</${markTags[mark]}>`,
            escapeHtml(node.value),
          );
        }
        if (node.type === 'link')
          return `<a href="${href(node.href)}">${inline(node.children)}</a>`;
        const number = footnoteNumbers.get(node.id);
        return `<sup><a href="#fn-${number}">${number}</a></sup>`;
      })
      .join('');

  const block = (item: ArticleBlock): string => {
    switch (item.type) {
      case 'paragraph':
        return `<p>${inline(item.children)}</p>`;
      case 'heading':
        return `<h${item.level} id="${escapeHtml(item.id)}">${inline(item.children)}</h${item.level}>`;
      case 'image': {
        if (!options.images) return item.caption ? `<p><em>${inline(item.caption)}</em></p>` : '';
        const caption = item.caption ? `<figcaption>${inline(item.caption)}</figcaption>` : '';
        return `<figure><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" />${caption}</figure>`;
      }
      case 'list': {
        const tag = item.ordered ? 'ol' : 'ul';
        return `<${tag}>${item.items.map((entry) => `<li>${inline(entry)}</li>`).join('')}</${tag}>`;
      }
      case 'quote': {
        const attribution = item.attribution ? `<p>— ${escapeHtml(item.attribution)}</p>` : '';
        return `<blockquote><p>${inline(item.children)}</p>${attribution}</blockquote>`;
      }
      case 'callout': {
        const title = item.title ? `<p><strong>${escapeHtml(item.title)}</strong></p>` : '';
        return `<aside>${title}<p>${inline(item.children)}</p></aside>`;
      }
      case 'divider':
        return '<hr />';
      default:
        return assertExhaustiveBlock(item);
    }
  };

  const parts: string[] = [];
  if (options.images) {
    parts.push(
      `<p><img src="${escapeHtml(article.cover.src)}" alt="${escapeHtml(article.cover.alt)}" /></p>`,
    );
  }
  parts.push(...article.blocks.map(block));
  if (article.footnotes.length > 0) {
    const notes = article.footnotes
      .map((note, index) => `<li id="fn-${index + 1}">${inline(note.children)}</li>`)
      .join('');
    parts.push(`<h2>Notes</h2><ol>${notes}</ol>`);
  }
  if (article.references.length > 0) {
    const sources = article.references
      .map(
        (source) =>
          `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>${
            source.publisher ? `, ${escapeHtml(source.publisher)}` : ''
          }</li>`,
      )
      .join('');
    parts.push(`<h2>Sources</h2><ul>${sources}</ul>`);
  }
  return parts.join('\n');
}
