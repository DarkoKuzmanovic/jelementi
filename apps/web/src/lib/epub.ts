import { escapeHtml } from './article/article-html';

export interface EpubChapter {
  title: string;
  /** Well-formed XHTML body content. */
  body: string;
}

export interface EpubBook {
  id: string;
  title: string;
  author: string;
  language: string;
  /** ISO timestamp without milliseconds, e.g. 2026-10-21T00:00:00Z. */
  modified: string;
  chapters: readonly EpubChapter[];
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal ZIP writer: stored (uncompressed) entries only, which also satisfies
 * EPUB's rule that `mimetype` comes first, uncompressed, with no extra field.
 * shortcut: no compression, so e-books are larger; fine for text-only series.
 */
export function zipStored(
  files: readonly { name: string; data: string }[],
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(12, 0x21, true); // 1980-01-01: stable bytes across builds
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

const xhtml = (title: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escapeHtml(title)}</title></head>
<body>
${body}
</body>
</html>
`;

/** Builds an EPUB 3 book with one XHTML file per chapter and a navigation document. */
export function buildEpub(book: EpubBook): Uint8Array<ArrayBuffer> {
  const chapterFiles = book.chapters.map((chapter, index) => ({
    id: `chapter-${index + 1}`,
    href: `chapter-${index + 1}.xhtml`,
    chapter,
  }));
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeHtml(book.id)}</dc:identifier>
    <dc:title>${escapeHtml(book.title)}</dc:title>
    <dc:creator>${escapeHtml(book.author)}</dc:creator>
    <dc:language>${escapeHtml(book.language)}</dc:language>
    <meta property="dcterms:modified">${escapeHtml(book.modified)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${chapterFiles.map((file) => `    <item id="${file.id}" href="${file.href}" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine>
${chapterFiles.map((file) => `    <itemref idref="${file.id}"/>`).join('\n')}
  </spine>
</package>
`;
  const nav = xhtml(
    book.title,
    `<nav epub:type="toc" id="toc"><h1>${escapeHtml(book.title)}</h1><ol>${chapterFiles
      .map((file) => `<li><a href="${file.href}">${escapeHtml(file.chapter.title)}</a></li>`)
      .join('')}</ol></nav>`,
  );
  return zipStored([
    { name: 'mimetype', data: 'application/epub+zip' },
    {
      name: 'META-INF/container.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`,
    },
    { name: 'OEBPS/content.opf', data: opf },
    { name: 'OEBPS/nav.xhtml', data: nav },
    ...chapterFiles.map((file) => ({
      name: `OEBPS/${file.href}`,
      data: xhtml(
        file.chapter.title,
        `<h1>${escapeHtml(file.chapter.title)}</h1>\n${file.chapter.body}`,
      ),
    })),
  ]);
}
