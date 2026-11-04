/** "THE WORLD’S STRONGEST WARRIORS" → "The World’s Strongest Warriors". Official set names are all caps. */
export function titleCase(name: string): string {
  if (name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s\-–(“"'/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Some products are officially named by their code ("OP15-EB04"); show the kind of product instead. */
export function setDisplayName(set: { name: string; code: string }, kindLabel: string): string {
  const bare = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return bare(set.name) === bare(set.code) ? kindLabel : titleCase(set.name);
}

/** A release date ("2026-08-28", or a timestamp starting with it) for display, without time-zone shifts. */
export function formatReleaseDate(value: string | null, locale: string, month: 'short' | 'long'): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString(locale, { year: 'numeric', month, day: 'numeric', timeZone: 'UTC' });
}
