import { describe, expect, it } from 'vitest';
import { SearchTextSchema } from '@jelementi/article-model';
import { highlightText, storySnippet, popularTags, validateSearchText } from './search';

describe('search text boundary', () => {
  it('accepts case-preserved and empty bodies, rejects malformed maps', () => {
    expect(SearchTextSchema.parse({ story: 'Vinča', empty: '' })).toEqual({
      story: 'Vinča',
      empty: '',
    });
    for (const value of [[], null, { story: 2 }, { '': 'body' }])
      expect(SearchTextSchema.safeParse(value).success).toBe(false);
  });
  it('requires the exact published slug set', () => {
    expect(validateSearchText({ story: 'Body' }, [{ slug: 'story' }])).toEqual({ story: 'Body' });
    expect(() => validateSearchText({}, [{ slug: 'story' }])).toThrow();
    expect(() => validateSearchText({ draft: 'Secret' }, [])).toThrow();
  });
});

describe('text-node search highlighting', () => {
  it('maps folded terms back to original composed and decomposed characters', () => {
    expect(highlightText('Visit Vinča and C\u030cačak.', 'vinca cacak')).toEqual([
      { text: 'Visit ', match: false },
      { text: 'Vinča', match: true },
      { text: ' and ', match: false },
      { text: 'C\u030cačak', match: true },
      { text: '.', match: false },
    ]);
  });
  it('merges overlaps and preserves literal markup as text', () => {
    expect(highlightText('<script>banana</script>', 'ana banana')).toEqual([
      { text: '<script>', match: false },
      { text: 'banana', match: true },
      { text: '</script>', match: false },
    ]);
    expect(highlightText('No match', '')).toEqual([{ text: 'No match', match: false }]);
  });
});

describe('story snippets', () => {
  const article = { title: 'A river', excerpt: 'A walk through time.' };
  it('returns case-preserved text at word boundaries around the first folded body match', () => {
    const body =
      'Opening words '.repeat(9) +
      'The Vinča settlement has a Blue river. ' +
      'Closing words '.repeat(9);
    const snippet = storySnippet(article, body, 'vinca');
    expect(snippet).toContain('Vinča');
    expect(snippet).toMatch(/^…(?:Opening|words|The)/);
    expect(snippet).toMatch(/(?:Closing|words|river\.)…$/);
    expect(snippet!.length).toBeGreaterThan(85);
    expect(snippet!.length).toBeLessThan(125);
  });
  it('uses the shorter mobile context without splitting words', () => {
    const body =
      'Opening words '.repeat(9) +
      'The Vinča settlement has a Blue river. ' +
      'Closing words '.repeat(9);
    const article = { title: 'A story', excerpt: 'A walk.' };
    expect(storySnippet(article, body, 'vinca', 84)!.length).toBeLessThan(
      storySnippet(article, body, 'vinca')!.length,
    );
  });
  it('omits the box for absent, blank, title-only and excerpt-only matches', () => {
    for (const query of ['absent', '', 'river', 'walk'])
      expect(storySnippet(article, 'No body match.', query)).toBeNull();
    expect(storySnippet(article, 'A river runs.', 'river')).toBeNull();
  });
  it('keeps complete boundary matches and shows the hidden term of a multi-term query', () => {
    expect(storySnippet(article, 'Vinča', 'vinca')).toBe('Vinča');
    expect(storySnippet(article, 'Vinča is beside the river.', 'river vinca')).toBe(
      'Vinča is beside the river.',
    );
    expect(storySnippet(article, 'x'.repeat(130), 'x'.repeat(120))).toBe('x'.repeat(130));
  });
});

describe('Try chips', () => {
  it('counts a tag once per story, ranks by usage and breaks ties by first catalog occurrence', () => {
    expect(
      popularTags([
        { tags: ['Serbia', 'Belgrade', 'Serbia'] },
        { tags: ['archaeology', 'Serbia'] },
        { tags: ['Kalemegdan', 'Belgrade', 'extra'] },
      ]),
    ).toEqual(['Serbia', 'Belgrade', 'archaeology', 'Kalemegdan']);
    expect(popularTags([])).toEqual([]);
  });
});
