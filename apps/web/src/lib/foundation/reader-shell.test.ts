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

import ReaderLayout from '../../routes/(reader)/+layout.svelte';
import RootError from '../../routes/+error.svelte';
import StudioError from '../../routes/studio/+error.svelte';
import StudioShell from '../studio/StudioShell.svelte';

const childSnippet = createRawSnippet(() => ({ render: () => '<p>page-content</p>' }));

function renderReaderAt(pathname: string) {
  mockedPage.url = new URL(`https://jelementi.quz.ma${pathname}`);
  return render(ReaderLayout, { props: { children: childSnippet } });
}

function renderRootErrorAt(pathname: string, status: number) {
  mockedPage.url = new URL(`https://jelementi.quz.ma${pathname}`);
  mockedPage.status = status;
  mockedPage.error = { message: 'Internal detail that must not reach Reader recovery.' };
  return render(RootError);
}

function renderStudioErrorAt(status: number) {
  mockedPage.url = new URL('https://jelementi.quz.ma/studio/missing');
  mockedPage.status = status;
  mockedPage.error = { message: 'Preserved Studio error detail.' };
  return render(StudioError);
}

function renderStudio() {
  return render(StudioShell, {
    props: { heading: 'Publishing workspace', children: childSnippet },
  });
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
      expect(body).toContain('href="#main-content"');
      expect(body).toContain('Skip to main content');
      expect(body).toContain('id="main-content"');
      // Visible nav links exist in both header and footer
      for (const href of ['href="/"', 'href="/categories"', 'href="/search"', 'href="/about"']) {
        expect(body).toContain(href);
      }
      // Jelementi wordmark present
      expect(body).toContain('Jelementi');
      // Child content is inside main
      expect(body).toContain('page-content');
      expect(body.indexOf('id="main-content"')).toBeLessThan(body.indexOf('page-content'));
    });
  }

  it('keeps Studio errors in a Studio-owned boundary with unchanged behavior', () => {
    const notFound = renderStudioErrorAt(404).body;
    expect(notFound).toContain('Page not found');
    expect(notFound).toContain('The page you requested is not available.');
    expect(notFound).toContain('<a href="/">Return to the reader</a>');
    expect(notFound).not.toContain('site-header');

    const ordinary = renderStudioErrorAt(500).body;
    expect(ordinary).toContain('Something went wrong');
    expect(ordinary).toContain('Preserved Studio error detail.');
    expect(ordinary).toContain('<a href="/">Return to the reader</a>');
  });

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
    expect(body).toContain('<a class="skip-link" href="#main-content"');
    // The skip target must be focusable via tabindex="-1" so programmatic focus works
    expect(body).toContain('id="main-content" tabindex="-1"');
    // Ensure the skip link appears before main for keyboard order
    expect(body.indexOf('skip-link')).toBeLessThan(body.indexOf('id="main-content"'));
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
    expect(categoryBody).toMatch(/href="\/categories"[^>]*aria-current="page"/);
  });

  it('keeps navigation visible at all widths: conventional wrapping, never a hidden menu', () => {
    const { body } = renderReaderAt('/');
    // No burger/menu toggle, hidden attribute, or aria-hidden on nav
    expect(body).not.toMatch(/aria-hidden="true"/);
    expect(body).not.toMatch(/<button[^>]*menu/i);
    // Header/footer inner containers use wrapping-friendly layout (flex-wrap)
    // Assert on rendered CSS presence via layout source is stable public seam:
    // the spec requires conventional wrapping, so we verify the layout's style
    // contains flex-wrap and the narrow reflow container pattern.
    const shellSource = readFileSync(
      new URL('../../routes/(reader)/ReaderShell.svelte', import.meta.url),
      'utf8',
    );
    expect(shellSource).toContain('flex-wrap: wrap');
    expect(shellSource).toContain('min(42rem, calc(100% - 2rem))');
    // Ensure landmark links are not hidden via inline hidden/styles
    expect(body).not.toContain(' hidden');
  });

  it('excludes the reader shell from the studio surface', () => {
    const { body: studioBody } = renderStudio();
    expect(studioBody).toContain('studio-shell');
    expect(studioBody).toContain('Publishing workspace');
    expect(studioBody).not.toContain('site-header');
    expect(studioBody).not.toContain('site-footer');
    expect(studioBody).not.toContain('skip-link');
    expect(studioBody).not.toContain('id="main-content"');
  });

  it('owns shells structurally: shared root contains no Reader-versus-Studio branching', () => {
    const rootLayout = readFileSync(
      new URL('../../routes/+layout.svelte', import.meta.url),
      'utf8',
    );
    const rootError = readFileSync(new URL('../../routes/+error.svelte', import.meta.url), 'utf8');
    expect(rootLayout).not.toMatch(/isStudio/);
    expect(rootLayout).not.toMatch(/\/studio/);
    expect(rootLayout).not.toMatch(/#if.*isStudio/);
    expect(rootLayout).not.toContain('site-header');
    expect(rootLayout).not.toContain('site-footer');
    expect(rootError).not.toMatch(/studioPath|\/studio/);
    // Root layout only imports foundation and renders children
    expect(rootLayout).toContain("import '../app.css'");
    expect(rootLayout).toContain('{@render children()}');
  });

  it('consumes shared foundation broadly via token aliasing, not duplication', () => {
    const studioTokens = readFileSync(new URL('../studio/tokens.css', import.meta.url), 'utf8');
    // Focus ownership lives in token boundary, not component override
    expect(studioTokens).toContain('--studio-focus: var(--foundation-focus)');
    // Palette foundations alias shared tokens
    for (const alias of [
      '--studio-canvas: var(--foundation-canvas)',
      '--studio-panel: var(--foundation-paper)',
      '--studio-text-primary: var(--foundation-ink)',
      '--studio-text-muted: var(--foundation-muted)',
      '--studio-border: var(--foundation-rule)',
      '--studio-link: var(--foundation-link)',
      '--studio-surface-selected: var(--foundation-accent-soft)',
      '--studio-action-primary-bg: var(--foundation-accent)',
    ]) {
      expect(studioTokens).toContain(alias);
    }
    // Type foundations alias shared scale
    expect(studioTokens).toContain('--studio-font-interface: var(--font-sans)');
    expect(studioTokens).toContain('--studio-font-editorial: var(--font-serif)');
    expect(studioTokens).toContain('--studio-font-evidence: var(--font-mono)');
    // Spacing and radius alias shared scale
    for (const token of [
      '--studio-space-1: var(--space-1)',
      '--studio-space-12: var(--space-12)',
      '--studio-radius-control: var(--radius-control)',
      '--studio-radius-pill: var(--radius-pill)',
    ]) {
      expect(studioTokens).toContain(token);
    }
    // No duplicated literal hex where aliasing should occur
    // Studio-semantic tokens (danger/info/disabled/evidence) legitimately
    // keep literals; check that foundation literals are not duplicated for
    // aliased roles — canvas/panel/text etc should not appear as hex
    expect(studioTokens).not.toMatch(/--studio-canvas:\s*#f3f0e9/);
    expect(studioTokens).not.toMatch(/--studio-panel:\s*#fff/);
    expect(studioTokens).not.toMatch(/--studio-focus:\s*#/);
  });

  it('studio visibly consumes shared Jelementi identity without changing lifecycle semantics', () => {
    const studioShell = readFileSync(
      new URL('../studio/StudioShell.svelte', import.meta.url),
      'utf8',
    );
    expect(studioShell).toContain('jelementi-wordmark');
    expect(studioShell).not.toMatch(/#1459d9/);
    expect(studioShell).not.toMatch(/#93c5fd/);
    expect(studioShell).not.toContain('--studio-focus');
    const { body } = renderStudio();
    expect(body).toContain('jelementi-wordmark');
    expect(body).toContain('Jelementi Studio');
  });
});
