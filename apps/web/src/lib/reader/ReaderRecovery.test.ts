import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ReaderRecovery from '../../routes/(reader)/ReaderRecovery.svelte';

describe('ReaderRecovery', () => {
  it('renders exact plain 404 recovery with the three canonical destinations', () => {
    const { body } = render(ReaderRecovery, { props: { status: 404 } });

    expect(body).toContain('This page is not available.');
    expect(body).toContain('The address may be incorrect, or the page may have moved.');
    expect(body).toContain('aria-label="Page recovery"');
    expect(body).toContain('href="/"');
    expect(body).toContain('href="/search"');
    expect(body).toContain('href="/categories"');
    expect(body).not.toContain('Try again');
  });

  it('renders a meaningful Try again link only for a retryable ordinary error', () => {
    const retryable = render(ReaderRecovery, {
      props: { status: 503, retryHref: '/articles/example?from=error' },
    }).body;
    const nonretryable = render(ReaderRecovery, { props: { status: 500 } }).body;

    expect(retryable).toContain('The page could not be loaded.');
    expect(retryable).toContain('href="/articles/example?from=error"');
    expect(retryable).toContain('Try again');
    expect(nonretryable).toContain('The page could not be loaded.');
    expect(nonretryable).toContain('Use another route to continue reading.');
    expect(nonretryable).not.toContain('Try again');
  });

  it('never exposes arbitrary ordinary-error detail in the recovery contract', () => {
    const { body } = render(ReaderRecovery, { props: { status: 500 } });

    expect(body).not.toMatch(/stack|exception|reader acceptance ordinary error/i);
  });
});
