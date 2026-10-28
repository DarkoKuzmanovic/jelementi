import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Kicker from './Kicker.svelte';

describe('Kicker', () => {
  it('renders a category with a decorative hue dot and optional extra', () => {
    const { body } = render(Kicker, {
      props: { category: 'History', categorySlug: 'history', extra: 'Lead story' },
    });
    expect(body).toContain('History');
    expect(body).toContain('Lead story');
    expect(body).toContain('var(--hue-history)');
    expect(body).toContain('aria-hidden="true"');
  });

  it('omits the extra and uses the accent for unknown categories', () => {
    const { body } = render(Kicker, { props: { category: 'Other', categorySlug: 'other' } });
    expect(body).toContain('var(--foundation-accent)');
    expect(body).not.toContain('·');
  });
});
