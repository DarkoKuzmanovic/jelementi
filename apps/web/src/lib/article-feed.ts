import { articleHtml } from './article/article-html';
import type { GeneratedContent } from './generated-content';
import { escapeXml, rssDate } from './podcast';

/**
 * Full-text RSS 2.0 feed of every published article (newest first), so feed
 * readers such as KOReader's news downloader get the whole story offline.
 */
export function buildArticleFeed(content: GeneratedContent, siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const items = content.index.flatMap((entry) => {
    const article = content.articles[entry.slug];
    if (article === undefined) return [];
    const url = `${origin}/articles/${article.slug}`;
    const html = articleHtml(article, { siteOrigin: origin, images: true });
    return [
      [
        '    <item>',
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${rssDate(entry.publishedAt)}</pubDate>`,
        `      <category>${escapeXml(article.category)}</category>`,
        `      <description>${escapeXml(article.excerpt)}</description>`,
        `      <content:encoded>${escapeXml(html)}</content:encoded>`,
        '    </item>',
      ].join('\n'),
    ];
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Jelementi</title>',
    `    <link>${escapeXml(origin)}</link>`,
    '    <description>Curious, careful stories from nearby and far away.</description>',
    '    <language>en</language>',
    `    <atom:link href="${escapeXml(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
