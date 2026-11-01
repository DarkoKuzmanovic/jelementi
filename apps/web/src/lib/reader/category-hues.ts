const hues = new Map([
  ['history', 'var(--hue-history)'],
  ['places', 'var(--hue-places)'],
  ['science', 'var(--hue-science)'],
  ['inventions', 'var(--hue-inventions)'],
  ['nature', 'var(--hue-nature)'],
  ['culture', 'var(--hue-culture)'],
]);

export function categoryHue(slug: string): string {
  return hues.get(slug) ?? 'var(--foundation-accent)';
}
