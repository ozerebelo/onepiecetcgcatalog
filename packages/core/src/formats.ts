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
