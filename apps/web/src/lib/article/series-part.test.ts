import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadReaderAcceptanceContent } from '../../../../../scripts/reader-acceptance-fixtures';
import { projectSeries } from '../series/series-projection';
import ArticleOpening from './ArticleOpening.svelte';
import ArticleContinuation from './ArticleContinuation.svelte';

const content = loadReaderAcceptanceContent('representative');
const series = projectSeries(Object.values(content.index))[0]!;
const article = content.articles[series.parts[0]!.slug]!;
const clean = (html: string) => html.replace(/<!--.*?-->/g, '');

describe('second edition series part', () => {
  it('puts linked numbered route discs before the series kicker and short title', () => {
    const html = clean(render(ArticleOpening, { props: { article, series } }).body);
    expect(html.indexOf('article-series-position')).toBeLessThan(html.indexOf('reader-kicker'));
    expect(html).toMatch(/aria-current="step"[^>]*>1<\/span>/);
    expect(html).toMatch(new RegExp(`href="/articles/${series.parts[1]!.slug}"[^>]*>2</a>`));
    expect(html).toContain(`${series.title} · Part 1 of ${series.parts.length}`);
    expect(html).toContain('>The first tower</h1>');
    expect(html).not.toContain('article-series-position__previous');
    expect(html).toContain('article-series-position__next');
  });
  it('keeps an unrelated title intact and omits the last part’s next card', () => {
    const last = content.articles[series.parts.at(-1)!.slug]!;
    const html = clean(
      render(ArticleOpening, { props: { article: { ...last, title: 'Unchanged title' }, series } })
        .body,
    );
    expect(html).toContain('>Unchanged title</h1>');
    expect(html).toContain('article-series-position__previous');
    expect(html).not.toContain('article-series-position__next');
  });
  it('ends with every part, minutes, current location and tools before Keep reading', () => {
    const html = clean(
      render(ArticleContinuation, { props: { article, series, nextOlder: null, studyDates: true } })
        .body,
    );
    expect(html).toContain('Next: Part 2, The middle tower');
    expect(html).toContain('Read part 2 →');
    expect(html.match(/class="article-series-continuation__part"/g)).toHaveLength(
      series.parts.length,
    );
    expect(html).toContain('You are here');
    for (const part of series.parts) expect(html).toContain(`${part.readingTimeMinutes} min`);
    expect(html).not.toContain('Up next');
    expect(html).not.toContain('read</span>');
    expect(html.indexOf('Download the series')).toBeLessThan(html.indexOf('article-keep-reading'));
    expect(html).toContain('Dates to remember: study cards');
    const last = content.articles[series.parts.at(-1)!.slug]!;
    const ending = clean(
      render(ArticleContinuation, { props: { article: last, series, nextOlder: null } }).body,
    );
    expect(ending).toContain('Back to part 1');
    expect(ending).not.toContain('Next: Part');
    expect(ending).not.toContain('Read part');
    expect(ending.match(/class="article-series-continuation__part"/g)).toHaveLength(
      series.parts.length,
    );
  });
});
