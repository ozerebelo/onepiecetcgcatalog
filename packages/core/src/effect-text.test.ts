import { describe, expect, it } from 'vitest';

import { keywordKey, parseEffectText } from './effect-text';
import { legality } from './formats';

describe('parseEffectText', () => {
  it('splits keywords, types and card names out of the text', () => {
    const segments = parseEffectText(
      '[DON!! x1] [When Attacking] If you have a {Land of Wano} type Character, play [Kouzuki Oden].',
    );
    expect(segments).toEqual([
      { type: 'keyword', text: 'DON!! x1', kind: 'don', key: 'donX' },
      { type: 'text', text: ' ' },
      { type: 'keyword', text: 'When Attacking', kind: 'timing', key: 'When Attacking' },
      { type: 'text', text: ' If you have a ' },
      { type: 'trait', text: 'Land of Wano' },
      { type: 'text', text: ' type Character, play ' },
      { type: 'card', text: 'Kouzuki Oden' },
      { type: 'text', text: '.' },
    ]);
  });

  it('knows the colour group of each label', () => {
    const kinds = parseEffectText('[Counter][Trigger][Blocker][Once Per Turn][On K.O.]').map((s) =>
      s.type === 'keyword' ? s.kind : s.type,
    );
    expect(kinds).toEqual(['counter', 'trigger', 'ability', 'limit', 'timing']);
  });

  it('leaves plain text alone', () => {
    expect(parseEffectText('Draw 1 card.')).toEqual([{ type: 'text', text: 'Draw 1 card.' }]);
    expect(parseEffectText('')).toEqual([]);
  });

  it('shares one rules note across DON!! amounts', () => {
    expect(keywordKey('DON!! x2')).toBe('donX');
    expect(keywordKey('Blocker')).toBe('Blocker');
    expect(keywordKey('Roronoa Zoro')).toBeNull();
  });
});

describe('legality', () => {
  it('follows the current Standard block window', () => {
    expect(legality(1)).toBe('extra');
    expect(legality(2)).toBe('standard');
    expect(legality(5)).toBe('standard');
    expect(legality(null)).toBe('unknown');
  });
});

describe('deckLegality', () => {
  it('finds rotated cards, banned cards and banned pairs', async () => {
    const { deckLegality } = await import('./formats');
    const result = deckLegality([
      { card_id: 'OP01-001', block: 1 },
      { card_id: 'OP05-001', block: 2 },
      { card_id: 'OP14-020', block: 4 },
      { card_id: 'OP11-040', block: 3 },
      { card_id: 'OP08-069', block: 2 },
      { card_id: 'EB05-014', block: null },
    ]);
    expect(result.rotated).toEqual(['OP01-001']);
    expect(result.banned).toEqual(['OP14-020']);
    expect(result.pairs).toEqual([['OP11-040', 'OP08-069']]);
    expect(result.unknown).toEqual(['EB05-014']);
  });

  it('is clean for a legal deck', async () => {
    const { deckLegality } = await import('./formats');
    expect(deckLegality([{ card_id: 'OP09-001', block: 3 }])).toEqual({ rotated: [], banned: [], pairs: [], unknown: [] });
  });
});
