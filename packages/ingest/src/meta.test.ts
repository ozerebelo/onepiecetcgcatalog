import { describe, expect, it } from 'vitest';

import { META_FILE, readMetaDecks } from './meta';

describe('meta decks file', () => {
  it('is valid (every list 1 leader + 50 cards, sourced and dated)', async () => {
    const decks = await readMetaDecks(META_FILE);
    expect(Array.isArray(decks)).toBe(true);
    expect(new Set(decks.map((d) => d.slug)).size).toBe(decks.length);
  });
});
