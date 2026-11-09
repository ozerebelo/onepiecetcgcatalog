/**
 * Effect texts mark game terms the way the printed card does: `[On Play]`, `[Blocker]`, `[DON!! x1]`
 * are labels, `{Land of Wano}` is a card type, and any other bracketed text is a card name
 * (`[Monkey.D.Luffy]`). This turns a text into segments the app can style and link.
 */

/** How a label is printed on the card, which decides its colour. */
export type KeywordKind =
  | 'timing' // when an effect happens: On Play, When Attacking, Activate: Main…
  | 'counter' // [Counter] events, used during the opponent's attack
  | 'trigger' // [Trigger], from the Life area
  | 'ability' // Blocker, Rush, Double Attack, Banish, Unblockable
  | 'limit' // Once Per Turn
  | 'don'; // DON!! x1, DON!! x2…

export type EffectSegment =
  | { type: 'text'; text: string }
  | { type: 'keyword'; text: string; kind: KeywordKind; key: string }
  | { type: 'trait'; text: string }
  | { type: 'card'; text: string };

const KEYWORDS: Record<string, KeywordKind> = {
  'On Play': 'timing',
  'When Attacking': 'timing',
  'Activate: Main': 'timing',
  Main: 'timing',
  'On K.O.': 'timing',
  'On Block': 'timing',
  "On Your Opponent's Attack": 'timing',
  'End of Your Turn': 'timing',
  "End of Your Opponent's Turn": 'timing',
  'Your Turn': 'timing',
  "Opponent's Turn": 'timing',
  Counter: 'counter',
  Trigger: 'trigger',
  Blocker: 'ability',
  Rush: 'ability',
  'Rush: Character': 'ability',
  'Double Attack': 'ability',
  Banish: 'ability',
  Unblockable: 'ability',
  'Once Per Turn': 'limit',
};

/** A stable key for a keyword's rules note ("DON!! x2" shares the note of every DON!! xN). */
export function keywordKey(label: string): string | null {
  if (/^DON!! ?x\d+$/i.test(label)) return 'donX';
  return label in KEYWORDS ? label : null;
}

export function keywordKind(label: string): KeywordKind | null {
  if (/^DON!! ?x\d+$/i.test(label)) return 'don';
  return KEYWORDS[label] ?? null;
}

/** Keywords a player filters by (the ones with a rules meaning of their own). */
export const FILTER_KEYWORDS = [
  'Blocker',
  'Rush',
  'Double Attack',
  'Banish',
  'Unblockable',
  'On Play',
  'When Attacking',
  'Activate: Main',
  'On K.O.',
  'Counter',
] as const;

export function parseEffectText(text: string): EffectSegment[] {
  const segments: EffectSegment[] = [];
  const pattern = /\[([^\]\n]+)\]|\{([^}\n]+)\}/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: 'text', text: text.slice(last, index) });
    if (match[1] !== undefined) {
      const label = match[1].trim();
      const kind = keywordKind(label);
      const key = keywordKey(label);
      segments.push(kind && key ? { type: 'keyword', text: label, kind, key } : { type: 'card', text: label });
    } else {
      segments.push({ type: 'trait', text: (match[2] ?? '').trim() });
    }
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}
