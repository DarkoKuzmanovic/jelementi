import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import StudioLifecycleSummary from './StudioLifecycleSummary.svelte';
import StudioEvidenceDisclosure from './StudioEvidenceDisclosure.svelte';
import StudioStatusAnnouncer from './StudioStatusAnnouncer.svelte';
import StudioShell from './StudioShell.svelte';
import { buildStudioWorkspaceProjection } from './workspace-projection';
import type { StudioLifecycle } from './contracts';

/** The one representative saved-and-ready draft used across #73's browser seam too. */
const readyLifecycle: StudioLifecycle = {
  kind: 'draft_valid',
  article: {
    slug: 'tristan-da-cunha',
    title: 'Tristan da Cunha',
    status: 'draft',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  branch: {
    name: 'studio/article/tristan-da-cunha',
    url: 'https://github.com/example/example/tree/studio/article/tristan-da-cunha',
    headSha: 'a'.repeat(40),
  },
};

const concurrency = { baseMainSha: 'b'.repeat(40), draftHeadSha: 'a'.repeat(40) };
const projection = buildStudioWorkspaceProjection(readyLifecycle, concurrency);

describe('StudioLifecycleSummary', () => {
  it('renders both lifecycle axes as separate plain-language facts', () => {
    const { body } = render(StudioLifecycleSummary, { props: { projection } });

    expect(body).toContain('Published version');
    expect(body).toContain('Not published');
    expect(body).toContain('Working change');
    expect(body).toContain('Ready to publish');
    expect(body).toContain(projection.summary);
    expect(body).toContain(projection.recommendedAction);
    expect(body.indexOf(projection.summary)).toBeLessThan(body.indexOf('Recommended:'));
    expect(body.indexOf('Recommended:')).toBeLessThan(body.indexOf('Published version'));
    expect(body.indexOf('Published version')).toBeLessThan(body.indexOf('Working change'));
  });

  it('always shows the validation summary, never gated behind Evidence disclosure', () => {
    const { body } = render(StudioLifecycleSummary, { props: { projection } });
    expect(body).toContain(projection.validationSummary);
  });
});

describe('StudioEvidenceDisclosure', () => {
  it('renders a native details/summary progressive disclosure with no JS required', () => {
    const { body } = render(StudioEvidenceDisclosure, { props: { projection } });

    expect(body).toContain('<details');
    expect(body).toContain('<summary');
    expect(body).toContain('Studio branch');
    expect(body).toContain(readyLifecycle.branch.headSha);
  });

  it('renders a diagnostic link for an evidence row that carries a URL', () => {
    const { body } = render(StudioEvidenceDisclosure, { props: { projection } });
    expect(body).toContain(`href="${readyLifecycle.branch.url}"`);
  });
});

describe('StudioStatusAnnouncer', () => {
  it('renders one polite status region and one assertive error region', () => {
    const { body } = render(StudioStatusAnnouncer, {
      props: { politeMessage: 'Ready to publish.' },
    });

    expect(body).toContain('role="status"');
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('Ready to publish.');
    expect(body).toContain('role="alert"');
    expect(body).toContain('aria-live="assertive"');
  });

  it('never renders ordinary typing as an announcement — only what is explicitly passed', () => {
    const { body } = render(StudioStatusAnnouncer, {});
    expect(body).toContain('role="status"');
    expect(body).toContain('role="alert"');
  });
});

describe('StudioShell', () => {
  it('establishes the semantic token scope and protected header', () => {
    const childSnippet = createRawSnippet(() => ({
      render: () => '<p>child-content</p>',
    }));
    const { body } = render(StudioShell, {
      props: { heading: 'Publishing workspace', children: childSnippet },
    });

    expect(body).toContain('studio-shell');
    expect(body).toContain('Publishing workspace');
  });
});
