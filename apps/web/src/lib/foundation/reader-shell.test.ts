import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';

const { mockedPage } = vi.hoisted(() => ({
  mockedPage: {
    url: new URL('https://jelementi.quz.ma/'),
    params: {},
    route: { id: '/' },
    status: 200,
    error: null as { message: string } | null,
  },
}));

vi.mock('$app/state', () => ({ page: mockedPage }));

import ReaderShell from '../../routes/(reader)/ReaderShell.svelte';

it('derives the utility date from the newest publication and exposes a GET query form', () => {
  mockedPage.url = new URL('https://jelementi.quz.ma/');
  const body = render(ReaderShell, {
    props: { children: childSnippet, storyCount: 7, newestPublishedAt: '2026-02-03' },
  }).body;
  expect(body).toContain('Updated 3 February 2026');
  expect(body).toContain('7 stories');
  expect(body).toMatch(/<form[^>]*action="\/search"[^>]*method="get"/);
  expect(body).toContain('name="query"');
});

it('renders supplied topic shortcuts before the utility links', () => {
  mockedPage.url = new URL('https://jelementi.quz.ma/');
  const topics = [
    { name: 'Science', slug: 'science' },
    { name: 'History', slug: 'history' },
  ];
  const body = render(ReaderShell, { props: { children: childSnippet, topics } }).body;
  const header = body.slice(body.indexOf('<header'), body.indexOf('</header>'));
  for (const topic of topics) expect(header).toContain(`href="/categories/${topic.slug}"`);
  const podcast = header.indexOf('href="/podcast.xml"');
  expect(header.indexOf('href="/categories/science"')).toBeLessThan(podcast);
  expect(header.indexOf('href="/about"')).toBeGreaterThan(podcast);
  expect(header.indexOf('action="/search"')).toBeGreaterThan(podcast);
});

import ReaderLayout from '../../routes/(reader)/+layout.svelte';
import RootError from '../../routes/+error.svelte';

const childSnippet = createRawSnippet(() => ({ render: () => '<p>page-content</p>' }));

function renderReaderAt(pathname: string) {
  mockedPage.url = new URL(`https://jelementi.quz.ma${pathname}`);
  return render(ReaderLayout, {
    props: {
      children: childSnippet,
      data: {
        topics: [{ name: 'History', slug: 'history' }],
        storyCount: 1,
        newestPublishedAt: '2026-07-26',
      },
    },
  });
}

function renderRootErrorAt(pathname: string, status: number) {
  mockedPage.url = new URL(`https://jelementi.quz.ma${pathname}`);
  mockedPage.status = status;
  mockedPage.error = { message: 'Internal detail that must not reach Reader recovery.' };
  return render(RootError);
}

describe('reader shell public contract', () => {
  const publicPaths = ['/', '/about', '/search', '/articles/known', '/categories/history'];

  for (const pathname of publicPaths) {
    it(`renders the persistent shell on ${pathname}`, () => {
      const { body } = renderReaderAt(pathname);
      // Landmarks
      expect(body).toContain('<header');
      expect(body).toContain('<main');
      expect(body).toContain('<footer');
      expect(body).toContain('aria-label="Primary navigation"');
      expect(body).toContain('aria-label="Footer navigation"');
      // Skip + main target pairing
      expect(body).toContain('href="#reader:main"');
      expect(body).toContain('Skip to main content');
      expect(body).toContain('id="reader:main"');
      // Visible nav links exist in both header and footer
      for (const href of ['href="/"', 'href="/categories"', 'href="/search"', 'href="/about"']) {
        expect(body).toContain(href);
      }
      // Jelementi wordmark present
      expect(body).toContain('Jelementi');
      // Child content is inside main
      expect(body).toContain('page-content');
      expect(body.indexOf('id="reader:main"')).toBeLessThan(body.indexOf('page-content'));
    });
  }

  it('renders the static fallback client through the normal shell with exact 404 recovery', () => {
    const { body } = renderRootErrorAt('/unknown-route', 404);

    expect(body.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(body).toContain('<header');
    expect(body).toContain('<footer');
    expect(body).toContain('This page is not available.');
    expect(body).toContain('aria-label="Page recovery"');
    for (const href of ['href="/"', 'href="/search"', 'href="/categories"']) {
      expect(body).toContain(href);
    }
    expect(body).not.toContain('Try again');
  });

  it('provides exactly one main landmark with a working skip target', () => {
    const { body } = renderReaderAt('/');
    const mainMatches = body.match(/<main\b/g) ?? [];
    expect(mainMatches).toHaveLength(1);
    expect(body).toContain('<a class="skip-link" href="#reader:main"');
    // The skip target must be focusable via tabindex="-1" so programmatic focus works
    expect(body).toContain('id="reader:main" tabindex="-1"');
    // Ensure the skip link appears before main for keyboard order
    expect(body.indexOf('skip-link')).toBeLessThan(body.indexOf('id="reader:main"'));
  });

  it('marks the current route with aria-current="page" and only there', () => {
    const { body: homeBody } = renderReaderAt('/');
    expect(homeBody).toMatch(/href="\/"[^>]*aria-current="page"/);
    expect(homeBody).not.toMatch(/href="\/about"[^>]*aria-current="page"/);

    const { body: aboutBody } = renderReaderAt('/about');
    expect(aboutBody).toMatch(/href="\/about"[^>]*aria-current="page"/);
    expect(aboutBody).not.toMatch(/href="\/"[^>]*aria-current="page"/);

    const { body: searchBody } = renderReaderAt('/search');
    expect(searchBody).toMatch(/href="\/search"[^>]*aria-current="page"/);

    const { body: categoryBody } = renderReaderAt('/categories/history');
    expect(categoryBody).toMatch(/href="\/categories\/history"[^>]*aria-current="page"/);
  });

  it('offers mobile CSS-only chips and footer recovery, without a menu toggle', () => {
    const { body } = renderReaderAt('/');
    expect(body).not.toMatch(/<button[^>]*menu/i);
    expect(body).toContain('class="mobile-search');
    const shellSource = readFileSync(new URL('../reader/reader.css', import.meta.url), 'utf8');
    expect(shellSource).toContain('overflow-x: auto');
    expect(shellSource).toContain('outline: 2px solid var(--foundation-focus)');
    expect(body).toContain('Every story lists its sources.');
  });
});
