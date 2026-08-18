import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StudioFlowboard from './StudioFlowboard.svelte';
import { buildStudioFlowboard } from './flowboard-projection';
import type { StudioArticleListEntry } from './contracts';

const mainSha = 'a'.repeat(40);

function row(
  slug: string,
  overrides: Partial<StudioArticleListEntry> = {},
): StudioArticleListEntry {
  return {
    slug,
    title: slug.replaceAll('-', ' '),
    canonicalStatus: 'published',
    updatedAt: '2026-08-17',
    production: 'pending_deployment',
    change: 'none',
    mainSha,
    ...overrides,
  };
}

describe('StudioFlowboard', () => {
  it('renders a purposeful empty state with New article prominent', () => {
    const { body } = render(StudioFlowboard, {
      props: { flowboard: buildStudioFlowboard([]) },
    });

    expect(body).toContain('No articles in Studio yet');
    expect(body).toContain('Create your first article');
    expect(body).toContain('/studio/articles/new');
  });

  it('server-renders every assigned article once with all three columns', () => {
    const flowboard = buildStudioFlowboard([
      row('resume-me', { change: 'draft', draftValidity: 'invalid' }),
      row('decide-on-me', { change: 'draft', draftValidity: 'valid' }),
      row('library-item'),
    ]);
    const { body } = render(StudioFlowboard, { props: { flowboard } });

    expect(body).toContain('Resume work');
    expect(body).toContain('Ready for your decision');
    expect(body).toContain('Library');
    for (const slug of ['resume-me', 'decide-on-me', 'library-item']) {
      expect(body.match(new RegExp(`data-article-slug="${slug}"`, 'g'))).toHaveLength(1);
    }
    expect(body).toContain('3 of 3 articles shown');
  });

  it('renders direct actions, an explicit Check status form, and native Evidence', () => {
    const flowboard = buildStudioFlowboard([
      row('ready-draft', { change: 'draft', draftValidity: 'valid' }),
      row('checking-change', { change: 'checking' }),
    ]);
    const { body } = render(StudioFlowboard, { props: { flowboard } });

    expect(body).toContain('Publish saved version');
    expect(body).toContain('/studio/articles/ready-draft#publication-center');
    expect(body).toContain('action="?/check"');
    expect(body).toContain('name="slug" value="checking-change"');
    expect(body).toContain('<details');
    expect(body).toContain('Evidence');
  });
});
