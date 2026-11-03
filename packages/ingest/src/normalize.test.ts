import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeEntities, normalize } from './normalize';
import { readPunkRecords, type RawCard, type RawSource } from './source';

function card(overrides: Partial<RawCard> & Pick<RawCard, 'id' | 'pack_id'>): RawCard {
  return {
    name: 'Roronoa Zoro',
    rarity: 'Leader',
    category: 'Leader',
    img_full_url: `https://img.example/${overrides.id}.png`,
    colors: ['Red'],
    cost: 5,
    attributes: ['Slash'],
    power: 5000,
    counter: null,
    types: ['Supernovas', 'Straw Hat Crew'],
    effect: '[DON!! x1] Your Characters gain +1000 power.',
    trigger: null,
    block_number: 1,
    ...overrides,
  };
}

const fixture: RawSource = {
  en: {
    packs: {
      '569101': { id: '569101', title_parts: { prefix: 'BOOSTER PACK', title: 'ROMANCE DAWN', label: 'OP-01' } },
      '569022': { id: '569022', title_parts: { prefix: 'STARTER DECK', title: 'Ace &amp; Newgate', label: 'ST-22' } },
      '569115': { id: '569115', title_parts: { prefix: '', title: 'BOOSTER PACK', label: 'OP15-EB04' } },
      '569801': { id: '569801', title_parts: { title: 'Other Product Card' } },
      '569301': { id: '569301', title_parts: { prefix: 'PREMIUM BOOSTER', title: 'ONE PIECE CARD THE BEST', label: 'PRB-01' } },
      '569114': { id: '569114', title_parts: { prefix: 'BOOSTER PACK', title: 'THE AZURE SEA’S SEVEN', label: 'OP14-EB04' } },
      '569901': { id: '569901', title_parts: { title: 'Promotion card' } },
    },
    cards: [
      card({ id: 'OP01-001', pack_id: '569101' }),
      card({ id: 'OP01-001_p1', pack_id: '569101' }),
      card({ id: 'OP01-016', pack_id: '569101', name: 'Nami', category: 'Character', rarity: 'Rare', effect: '-' }),
      card({ id: 'OP01-016_r1', pack_id: '569022', name: 'Nami', category: 'Character', rarity: 'Rare' }),
      card({ id: 'OP15-001', pack_id: '569115', name: 'Someone', category: 'Character', rarity: 'Common' }),
      // Listed in two products: kept once.
      card({ id: 'OP07-091_p1', pack_id: '569901', name: 'Promo', category: 'Character', rarity: 'Promo' }),
      card({ id: 'OP07-091_p1', pack_id: '569801', name: 'Promo', category: 'Character', rarity: 'Promo' }),
      card({ id: 'P-001', pack_id: '569901', name: 'Monkey.D.Luffy', category: 'Character', rarity: 'Promo' }),
      // Premium booster made of reprints: its card prefix (OP09) says nothing about the product.
      card({ id: 'OP09-001_p1', pack_id: '569301', name: 'Shanks', rarity: 'Leader' }),
      card({ id: 'OP14-001', pack_id: '569114', name: 'Someone', category: 'Character', rarity: 'Common' }),
      // Broken records are skipped with warnings.
      card({ id: 'NOT-AN-ID', pack_id: '569101' }),
      card({ id: 'OP01-099', pack_id: '569101', rarity: 'UltraMegaRare' }),
    ],
  },
  ja: {
    packs: {},
    cards: [
      card({ id: 'OP01-001', pack_id: '550101', name: 'ロロノア・ゾロ', types: ['超新星', '麦わらの一味'], effect: '【ドン!!×1】効果' }),
      card({ id: 'OP01-016', pack_id: '550101', name: 'ナミ', category: 'Character', rarity: 'Rare' }),
      // Japanese-only card (not released in English yet)
      card({ id: 'P-136', pack_id: '550901', name: 'ウソップ', category: 'Character', rarity: 'Promo', types: ['麦わらの一味'] }),
      card({ id: 'OP09-001_p1', pack_id: '550301', name: 'シャンクス', rarity: 'Leader' }),
      card({ id: 'OP14-001', pack_id: '550114', name: 'テスト', category: 'Character', rarity: 'Common' }),
      // Japanese product with no English twin
      card({ id: 'EB04-001', pack_id: '550204', name: 'テスト', category: 'Leader' }),
    ],
  },
};

describe('normalize', () => {
  const result = normalize(fixture);
  const cards = Object.fromEntries(result.cards.map((c) => [c.id, c]));
  const sets = Object.fromEntries(result.sets.map((s) => [s.id, s]));
  const printings = Object.fromEntries(result.printings.map((p) => [p.id, p]));

  it('creates one printing per language + art', () => {
    expect(Object.keys(printings)).toEqual(
      expect.arrayContaining(['en:OP01-001', 'en:OP01-001_p1', 'ja:OP01-001', 'en:OP01-016_r1', 'ja:P-136']),
    );
    expect(printings['en:OP01-001_p1']).toMatchObject({ card_id: 'OP01-001', variant: 'parallel', variant_index: 1 });
    expect(printings['en:OP01-016_r1']).toMatchObject({ card_id: 'OP01-016', variant: 'reprint', set_id: 'en-569022' });
  });

  it('keeps a printing listed in several products only once', () => {
    expect(result.printings.filter((p) => p.code === 'OP07-091_p1')).toHaveLength(1);
    expect(printings['en:OP07-091_p1']!.set_id).toBe('en-569801');
  });

  it('merges languages into one card, English text first', () => {
    expect(cards['OP01-001']).toMatchObject({
      name: 'Roronoa Zoro',
      name_en: 'Roronoa Zoro',
      name_ja: 'ロロノア・ゾロ',
      types: ['Supernovas', 'Straw Hat Crew'],
      effect_ja: '【ドン!!×1】効果',
    });
  });

  it('falls back to Japanese data for Japanese-only cards', () => {
    expect(cards['P-136']).toMatchObject({ name: 'ウソップ', name_en: null, name_ja: 'ウソップ', types: ['麦わらの一味'] });
  });

  it('treats "-" effects as empty', () => {
    expect(cards['OP01-016']!.effect).toBeNull();
  });

  it('skips malformed records with warnings', () => {
    expect(printings['en:NOT-AN-ID']).toBeUndefined();
    expect(cards['OP01-099']).toBeUndefined();
    expect(result.warnings).toHaveLength(2);
  });

  it('names sets from the product list', () => {
    expect(sets['en-569101']).toMatchObject({ code: 'OP-01', name: 'ROMANCE DAWN', kind: 'booster', printing_count: 3 });
    expect(sets['en-569022']).toMatchObject({ code: 'ST-22', name: 'Ace & Newgate', kind: 'starter' });
    expect(sets['en-569115']).toMatchObject({ code: 'OP15-EB04', name: 'OP15-EB04', kind: 'booster' });
    expect(sets['en-569901']).toMatchObject({ code: 'P', kind: 'promo' });
    expect(sets['en-569801']).toMatchObject({ code: 'OTHER', kind: 'other' });
  });

  it('borrows English product titles for matching Japanese products', () => {
    expect(sets['ja-550101']).toMatchObject({ code: 'OP-01', name: 'ROMANCE DAWN', kind: 'booster', language: 'ja' });
    expect(sets['ja-550901']).toMatchObject({ code: 'P', kind: 'promo' });
    expect(sets['ja-550204']).toMatchObject({ code: 'EB-04', name: 'EB-04', kind: 'extra' });
    expect(sets['ja-550301']).toMatchObject({ code: 'PRB-01', name: 'ONE PIECE CARD THE BEST', kind: 'premium' });
    // English bundles OP-14 with EB-04; the Japanese product is just OP-14.
    expect(sets['ja-550114']).toMatchObject({ code: 'OP-14', name: 'THE AZURE SEA’S SEVEN' });
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Ace &amp; Newgate')).toBe('Ace & Newgate');
    expect(decodeEntities('&quot;Captain&quot; &#39;Kid&#x27;')).toBe('"Captain" \'Kid\'');
    expect(decodeEntities('&unknown; stays')).toBe('&unknown; stays');
  });
});

// Optional check against a real punk-records checkout: PUNK_RECORDS_DIR=/path pnpm test
const realDir = process.env.PUNK_RECORDS_DIR;
describe.skipIf(!realDir || !existsSync(realDir))('normalize (real dataset)', () => {
  it('produces a consistent catalog', async () => {
    const result = normalize(await readPunkRecords(realDir!, ['en', 'ja']));
    const cardIds = new Set(result.cards.map((c) => c.id));
    const setIds = new Set(result.sets.map((s) => s.id));

    expect(result.warnings).toEqual([]);
    expect(result.cards.length).toBeGreaterThan(2500);
    expect(result.printings.length).toBeGreaterThan(9000);
    expect(result.printings.every((p) => cardIds.has(p.card_id) && setIds.has(p.set_id))).toBe(true);
    expect(result.sets.every((s) => s.name && s.code)).toBe(true);
    expect(result.sets.reduce((n, s) => n + s.printing_count, 0)).toBe(result.printings.length);
  });
});
