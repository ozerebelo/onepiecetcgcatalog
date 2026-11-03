import { describe, expect, it } from 'vitest';

import { compareSets, formatSetCode, rarityShort, setKindFor, variantLabel } from './sets';

describe('setKindFor', () => {
  it('prefers the product title prefix', () => {
    expect(setKindFor('569010', 'ULTRA DECK')).toBe('starter');
    expect(setKindFor('569021', 'STARTER DECK EX')).toBe('starter');
    expect(setKindFor('569201', 'EXTRA BOOSTER')).toBe('extra');
    expect(setKindFor('569301', 'premium booster')).toBe('premium');
  });

  it('falls back to the product id family digit', () => {
    expect(setKindFor('550001')).toBe('starter');
    expect(setKindFor('550101')).toBe('booster');
    expect(setKindFor('550204')).toBe('extra');
    expect(setKindFor('550301')).toBe('premium');
    expect(setKindFor('550901')).toBe('promo');
    expect(setKindFor('569801')).toBe('other');
    expect(setKindFor('569115', '')).toBe('booster');
  });
});

describe('formatSetCode', () => {
  it('inserts the dash', () => {
    expect(formatSetCode('OP01')).toBe('OP-01');
    expect(formatSetCode('PRB02')).toBe('PRB-02');
    expect(formatSetCode('P')).toBe('P');
  });
});

describe('compareSets', () => {
  it('groups by kind, newest first', () => {
    const sets = [
      { id: 'st1', kind: 'starter' as const, sort_order: 569001 },
      { id: 'op1', kind: 'booster' as const, sort_order: 569101 },
      { id: 'op2', kind: 'booster' as const, sort_order: 569102 },
      { id: 'promo', kind: 'promo' as const, sort_order: 569901 },
      { id: 'eb1', kind: 'extra' as const, sort_order: 569201 },
    ];
    expect(sets.sort(compareSets).map((s) => s.id)).toEqual(['op2', 'op1', 'eb1', 'st1', 'promo']);
  });
});

describe('labels', () => {
  it('shortens rarities', () => {
    expect(rarityShort('SecretRare')).toBe('SEC');
    expect(rarityShort('Uncommon')).toBe('UC');
  });

  it('labels variants', () => {
    expect(variantLabel('base', 0)).toBe('Base');
    expect(variantLabel('parallel', 1)).toBe('Parallel');
    expect(variantLabel('parallel', 3)).toBe('Parallel 3');
    expect(variantLabel('reprint', 1)).toBe('Reprint');
  });
});
