import { describe, expect, it } from 'vitest';
import { categoryHue } from './category-hues';

describe('categoryHue', () => {
  it('maps each known slug to its category token and unknown slugs to the accent', () => {
    for (const slug of ['history', 'places', 'science', 'inventions', 'nature']) {
      expect(categoryHue(slug)).toBe(`var(--hue-${slug})`);
    }
    for (const slug of ['unknown', 'constructor', '__proto__', '']) {
      expect(categoryHue(slug)).toBe('var(--foundation-accent)');
    }
  });
});
