import { normalizeSearchText, SearchTextSchema } from '@jelementi/article-model';

export interface HighlightRun {
  text: string;
  match: boolean;
}

export function validateSearchText(raw: unknown, index: ReadonlyArray<{ slug: string }>) {
  const text = SearchTextSchema.parse(raw);
  if (
    Object.keys(text).length !== index.length ||
    index.some(({ slug }) => !Object.hasOwn(text, slug))
  ) {
    throw new Error('Generated search text must contain exactly the published index slugs.');
  }
  return text;
}

export function popularTags(index: ReadonlyArray<{ tags: string[] }>): string[] {
  const counts = new Map<string, number>();
  for (const { tags } of index)
    for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag);
}

/** Match on folded text, but slice only the original text (including combining marks). */
export function highlightText(text: string, query: string): HighlightRun[] {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return [{ text, match: false }];
  let folded = '';
  const positions: { start: number; end: number }[] = [];
  let offset = 0;
  for (const char of text) {
    const value = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (let i = 0; i < value.length; i++)
      positions.push({ start: offset, end: offset + char.length });
    if (!value && positions.length) positions[positions.length - 1]!.end = offset + char.length;
    folded += value;
    offset += char.length;
  }
  // Whole-string casing preserves contextual sigma; NFD stripping removes expanding İ first.
  folded = folded.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  for (const term of terms) {
    for (let i = folded.indexOf(term); i !== -1; i = folded.indexOf(term, i + 1)) {
      ranges.push({ start: positions[i]!.start, end: positions[i + term.length - 1]!.end });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const runs: HighlightRun[] = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (start > cursor) runs.push({ text: text.slice(cursor, start), match: false });
    runs.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length || !runs.length) runs.push({ text: text.slice(cursor), match: false });
  return runs;
}

export function storySnippet(
  article: { title: string; excerpt: string },
  body: string,
  query: string,
  length = 110,
): string | null {
  const visible = normalizeSearchText(`${article.title} ${article.excerpt}`);
  const hiddenTerms = normalizeSearchText(query)
    .split(' ')
    .filter((term) => term && !visible.includes(term));
  if (!hiddenTerms.length) return null;
  const runs = highlightText(body, hiddenTerms.join(' '));
  const match = runs.findIndex((run) => run.match);
  if (match === -1) return null;
  const hit = runs.slice(0, match).reduce((length, run) => length + run.text.length, 0);
  const before = Math.round(length * 0.47);
  let start = Math.max(0, hit - before);
  while (start < hit && start > 0 && !/\s/.test(body[start - 1]!)) start++;
  if (start === hit) while (start > 0 && !/\s/.test(body[start - 1]!)) start--;
  const matchEnd = hit + runs[match]!.text.length;
  let end = Math.min(body.length, Math.max(hit + length - before, matchEnd));
  while (end > matchEnd && end < body.length && !/\s/.test(body[end]!)) end--;
  while (end < body.length && !/\s/.test(body[end]!)) end++;
  return `${start ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}
