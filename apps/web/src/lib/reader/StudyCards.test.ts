import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StudyCards from '../../routes/(reader)/series/[series]/dates/+page.svelte';

describe('study cards', () => {
  it('keeps dates inside native disclosures, with a series kicker and e-book download', () => {
    const { body } = render(StudyCards, {
      props: {
        data: {
          topics: [],
          storyCount: 1,
          categoryCount: 1,
          newestPublishedAt: undefined,
          series: { slug: 'example', title: 'Example', category: 'Places', categorySlug: 'places' },
          parts: [
            {
              part: 1,
              slug: 'first',
              title: 'First part',
              cards: [{ what: 'An event', when: '1402' }],
            },
          ],
        },
      },
    });
    expect(body).toMatch(/<h1[^>]*>Dates to remember<\/h1>/);
    expect(body).toContain('Example');
    expect(body).toContain('Tap to reveal');
    expect(body).toMatch(
      /<details[^>]*>\s*<summary[^>]*>An event[\s\S]*?<\/summary>[\s\S]*?1402[\s\S]*?<\/details>/,
    );
    expect(body).not.toMatch(/aria-hidden="true"[^>]*>1402/);
    expect(body).toContain('href="/series/example.epub"');
    expect(body).toContain('download');
  });
});
