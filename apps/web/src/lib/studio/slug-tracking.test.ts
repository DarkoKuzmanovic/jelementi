import { describe, expect, it } from 'vitest';
import {
  STUDIO_SLUG_MAX_LENGTH,
  deriveStudioSlug,
  resumesTitleTracking,
  slugDerivedFromTitle,
} from './slug-tracking';

describe('deriveStudioSlug', () => {
  it('kebab-cases a plain title', () => {
    expect(deriveStudioSlug('The Lighthouse Watch')).toBe('the-lighthouse-watch');
  });

  it('keeps digits and folds punctuation and whitespace runs into single hyphens', () => {
    expect(deriveStudioSlug('The 250 People at the End of the World')).toBe(
      'the-250-people-at-the-end-of-the-world',
    );
    expect(deriveStudioSlug('Hello, World! — A Story')).toBe('hello-world-a-story');
  });

  it('lowercases mixed-case input and strips leading/trailing separators', () => {
    expect(deriveStudioSlug('  "Quoted" Title... ')).toBe('quoted-title');
    expect(deriveStudioSlug('!!!')).toBe('');
  });

  it('is empty for an empty title', () => {
    expect(deriveStudioSlug('')).toBe('');
  });

  it('stays within the editor slug bound without a trailing hyphen', () => {
    const derived = deriveStudioSlug('word '.repeat(60));

    expect(derived.length).toBeLessThanOrEqual(STUDIO_SLUG_MAX_LENGTH);
    expect(derived.endsWith('-')).toBe(false);
    expect(derived).toBe(`${'word-'.repeat(19)}word`);
  });

  it('only produces values the slug contract accepts', () => {
    const samples = [
      'Hello, World!',
      'Über cool: an essay — part 2?!',
      '  spaced  out  ',
      'dots.and-dashes',
      '123 456',
      '',
      '!!!',
    ];
    for (const title of samples) {
      expect(deriveStudioSlug(title)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$|^$/);
    }
  });
});

describe('resumesTitleTracking', () => {
  it('resumes tracking only when the slug field was cleared back to empty', () => {
    expect(resumesTitleTracking('')).toBe(true);
    expect(resumesTitleTracking('hand-written-slug')).toBe(false);
    expect(resumesTitleTracking(' ')).toBe(false);
  });
});

describe('slugDerivedFromTitle', () => {
  it('derives the kebab-case slug while tracking is active', () => {
    expect(slugDerivedFromTitle('A Fresh Title', true)).toBe('a-fresh-title');
    expect(slugDerivedFromTitle('', true)).toBe('');
  });

  it('leaves a manually edited slug untouched once tracking is frozen', () => {
    expect(slugDerivedFromTitle('A Fresh Title', false)).toBeUndefined();
  });
});
