const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Human publication-date formatter shared by Reader discovery summaries
 * and the article opening (#101). The article model's ISO dates stay
 * unchanged; only the presentation form is formatted here.
 */
export function formatPublishedDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const month = MONTHS[date.getUTCMonth()];
  if (month === undefined) return value;
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}
