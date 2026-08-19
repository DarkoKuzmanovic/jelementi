import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { ArticleRenderer, ArticleSummary } from '../article/index';

const foundationCss = readFileSync(new URL('./foundation.css', import.meta.url), 'utf8');
const formsContract = readFileSync(new URL('./forms.md', import.meta.url), 'utf8');
const articleContract = readFileSync(new URL('../article/index.ts', import.meta.url), 'utf8');

const entry: ArticleIndexEntry = {
  slug: 'known',
  title: 'Known Article',
  excerpt: 'A deterministic excerpt.',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  categorySlug: 'history',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
  readingTimeMinutes: 3,
  searchText: 'known article',
};

describe('shared foundation', () => {
  it('declares light and dark palette foundations with neutral aliases', () => {
    for (const token of [
      '--foundation-canvas',
      '--foundation-paper',
      '--foundation-ink',
      '--foundation-muted',
      '--foundation-rule',
      '--foundation-link',
      '--foundation-focus',
      '--foundation-control-surface',
      '--foundation-control-border',
      '--foundation-control-text',
      '--foundation-control-disabled-surface',
      '--foundation-control-disabled-text',
    ]) {
      expect(foundationCss).toContain(token);
    }
    expect(foundationCss).toContain('@media (prefers-color-scheme: dark)');
  });

  it('declares typography, spacing, and radius scales', () => {
    for (const token of [
      '--font-sans',
      '--font-serif',
      '--font-mono',
      '--text-base',
      '--text-h1',
      '--space-1',
      '--space-12',
      '--radius-control',
      '--radius-pill',
    ]) {
      expect(foundationCss).toContain(token);
    }
  });

  it('declares identity, focus, bypass, and visually hidden helpers', () => {
    expect(foundationCss).toContain('.jelementi-wordmark');
    expect(foundationCss).toContain(':focus-visible');
    expect(foundationCss).toContain('outline: 3px solid var(--foundation-focus)');
    expect(foundationCss).toContain('.skip-link');
    expect(foundationCss).toContain('.visually-hidden');
  });

  it('respects reduced motion without client theme state', () => {
    expect(foundationCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(foundationCss).toContain('scroll-behavior: auto');
  });

  it('contains no Reader-versus-Studio branching', () => {
    expect(foundationCss).not.toMatch(/\.(reader|studio)\b/);
    expect(foundationCss).not.toMatch(
      /(reader|studio)-?(surface|specific)|surface-?(reader|studio)/i,
    );
  });

  it('documents the target shared form-core contract without promoting a control', () => {
    const lowered = formsContract.toLowerCase();
    for (const keyword of [
      'label',
      'help',
      'error',
      'aria linkage',
      'focus',
      'invalid',
      'disabled',
      'required',
      'validation timing',
      'recovery semantics',
    ]) {
      expect(lowered).toContain(keyword);
    }
  });
});

describe('shared discovery summary', () => {
  it('renders one semantic hierarchy: title link, excerpt, category, date, reading time', () => {
    const { body } = render(ArticleSummary, { props: { article: entry } });
    expect(body).toContain('article-summary__title');
    expect(body).toContain(`href="/articles/${entry.slug}"`);
    expect(body).toContain(entry.title);
    expect(body).toContain('article-summary__excerpt');
    expect(body).toContain(entry.excerpt);
    expect(body).toContain(`href="/categories/${entry.categorySlug}"`);
    expect(body).toContain(`datetime="${entry.publishedAt}"`);
    expect(body).toContain('26 July 2026');
    expect(body).toContain('3 min read');

    const headingIndex = body.indexOf('<h2');
    const excerptIndex = body.indexOf(entry.excerpt);
    const metaIndex = body.indexOf('article-summary__meta');
    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(headingIndex).toBeLessThan(excerptIndex);
    expect(excerptIndex).toBeLessThan(metaIndex);
  });
});

describe('authoritative article-rendering contract', () => {
  it('exports the renderer and summary from one shared module', () => {
    expect(articleContract).toContain(
      "export { default as ArticleRenderer } from './ArticleRenderer.svelte'",
    );
    expect(articleContract).toContain(
      "export { default as ArticleSummary } from './ArticleSummary.svelte'",
    );
    expect(ArticleRenderer).toBeTruthy();
    expect(ArticleSummary).toBeTruthy();
  });
});
