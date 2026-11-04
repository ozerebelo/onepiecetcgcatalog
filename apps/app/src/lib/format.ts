/** "THE WORLD’S STRONGEST WARRIORS" → "The World’s Strongest Warriors". Official set names are all caps. */
export function titleCase(name: string): string {
  if (name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s\-–(“"'/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
