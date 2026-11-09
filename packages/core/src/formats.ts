/**
 * Tournament formats. Since 1 April 2026, Standard uses the Block Number System: only cards whose
 * block icon is in the current window are legal (banlist aside); Extra allows every card ever printed.
 *
 * Current window: Blocks 2–5, until 31 March 2027 (then Block 2 rotates out). Update this file when
 * Bandai announces the next rotation. Sources: Bandai's regulation announcement as summarised by
 * misprint.com, bountytcg.app and kaizoku.app (2026). Exceptions Bandai lists (some reprinted card
 * numbers, Block X) are not modelled: cards are judged by the block number we store.
 */
export const STANDARD = {
  blocks: [2, 3, 4, 5] as readonly number[],
  /** Last day of the current window (ISO date). */
  until: '2027-03-31',
};

export type Legality = 'standard' | 'extra' | 'unknown';

/** Where a card with this block number can be played. */
export function legality(blockNumber: number | null | undefined): Legality {
  if (blockNumber == null) return 'unknown';
  return STANDARD.blocks.includes(blockNumber) ? 'standard' : 'extra';
}

/**
 * Banned cards and banned pairs, from Bandai's "Banned/Restricted Card Addition Notice"
 * (en.onepiece-cardgame.com/news/restriction.html), list effective 12 October 2026 (announced 24 September;
 * Dracule Mihawk OP14-020 added). Checked against that page on 9 November 2026.
 * There are no restricted cards. Bans cover every printing of a card number, parallels included.
 * Update this list when Bandai announces changes.
 */
export const BANLIST = {
  asOf: '2026-10-12',
  banned: ['OP03-040', 'OP06-047', 'OP06-086', 'OP06-116', 'OP14-020', 'ST10-001'] as readonly string[],
  /** These may not be in the same deck. */
  pairs: [
    ['OP07-115', 'EB04-058'],
    ['OP11-040', 'OP11-067'],
    ['OP11-040', 'OP08-069'],
  ] as readonly (readonly [string, string])[],
};

export interface DeckLegality {
  /** Cards outside the current Standard block window (playable in Extra). */
  rotated: string[];
  /** Banned in every format. */
  banned: string[];
  /** Banned pairs both present in the deck. */
  pairs: [string, string][];
  /** Cards with no known block number. */
  unknown: string[];
}

/** Whether a deck (its distinct cards with their block numbers) can be played in Standard / Extra. */
export function deckLegality(cards: readonly { card_id: string; block: number | null | undefined }[]): DeckLegality {
  const ids = new Set(cards.map((c) => c.card_id));
  return {
    rotated: cards.filter((c) => legality(c.block) === 'extra').map((c) => c.card_id),
    unknown: cards.filter((c) => legality(c.block) === 'unknown').map((c) => c.card_id),
    banned: cards.filter((c) => BANLIST.banned.includes(c.card_id)).map((c) => c.card_id),
    pairs: BANLIST.pairs.filter(([a, b]) => ids.has(a) && ids.has(b)).map(([a, b]) => [a, b]),
  };
}
