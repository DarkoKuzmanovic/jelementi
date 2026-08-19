import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AboutContent from '../../routes/(reader)/about/AboutContent.svelte';

describe('AboutContent', () => {
  it('renders the compact factual editorial statement without inventing optional details', () => {
    const { body } = render(AboutContent);

    expect(body).toContain('About Jelementi');
    expect(body).toContain('publishes carefully edited stories in English');
    expect(body).toContain('researched from documented sources');
    expect(body).toContain('edited for clarity and context');
    expect(body).not.toContain('Publication details');
    expect(body).not.toMatch(/mailto:|tel:|@jelementi/i);
  });

  it('renders optional ownership and contact facts only when verified values are supplied', () => {
    const { body } = render(AboutContent, {
      props: {
        facts: {
          ownership: 'Published by a verified owner.',
          contact: {
            label: 'Editorial email',
            value: 'editor@example.test',
            href: 'mailto:editor@example.test',
          },
        },
      },
    });

    expect(body).toContain('Publication details');
    expect(body).toContain('Published by a verified owner.');
    expect(body).toContain('Editorial email');
    expect(body).toContain('href="mailto:editor@example.test"');
    expect(body).toContain('editor@example.test');
  });
});
