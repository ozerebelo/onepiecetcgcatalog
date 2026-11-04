import { describe, expect, it } from 'vitest';

import { isOwnSetCard, parseDecklist, setCardPrefixes, toShoppingList, toSimList, validateDeck } from './deck';

const SIM_DECK = `1xOP01-001
4xOP01-016
4xOP01-025
4xST01-012
`;

describe('parseDecklist', () => {
  it('parses Sim exports', () => {
    expect(parseDecklist(SIM_DECK)).toEqual({
      items: [
        { card_id: 'OP01-001', quantity: 1 },
        { card_id: 'OP01-016', quantity: 4 },
        { card_id: 'OP01-025', quantity: 4 },
        { card_id: 'ST01-012', quantity: 4 },
      ],
      issues: [],
      total: 13,
    });
  });

  it('drops art suffixes and languages: any printing fills a slot', () => {
    const result = parseDecklist('2x OP01-016_p1 JP\n2x OP01-016\n1x op1-25');
    expect(result.items).toEqual([
      { card_id: 'OP01-016', quantity: 4 },
      { card_id: 'OP01-025', quantity: 1 },
    ]);
  });

  it('keeps going past unreadable lines', () => {
    const result = parseDecklist('4xOP01-016\nLeader: Zoro\n');
    expect(result.items).toHaveLength(1);
    expect(result.issues).toMatchObject([{ line: 2, message: 'noCardNumber' }]);
  });
});

describe('validateDeck', () => {
  const leader = { card_id: 'OP01-001', category: 'Leader' as const, quantity: 1 };
  const filler = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ card_id: `OP01-${String(i + 10).padStart(3, '0')}`, category: 'Character' as const, quantity: 4 }));

  it('accepts a legal deck', () => {
    const cards = [leader, ...filler(12), { card_id: 'OP01-099', category: 'Event' as const, quantity: 2 }];
    expect(validateDeck(cards)).toEqual([]);
  });

  it('reports missing leader, wrong size and too many copies', () => {
    expect(validateDeck([{ card_id: 'OP01-016', category: 'Character', quantity: 5 }])).toEqual([
      { kind: 'noLeader' },
      { kind: 'wrongSize', count: 5 },
      { kind: 'tooManyCopies', cardId: 'OP01-016', count: 5 },
    ]);
  });

  it('reports multiple leaders', () => {
    expect(validateDeck([leader, { ...leader, card_id: 'OP01-002' }, ...filler(12), { card_id: 'X-001', category: 'Event', quantity: 2 }])).toEqual([
      { kind: 'multipleLeaders', count: 2 },
    ]);
  });
});

describe('exports', () => {
  it('writes Sim and shopping lists', () => {
    const items = [{ card_id: 'OP01-016', quantity: 2, name: 'Nami' }, { card_id: 'OP01-025', quantity: 1 }];
    expect(toSimList(items)).toBe('2xOP01-016\n1xOP01-025\n');
    expect(toShoppingList(items)).toBe('2x OP01-016 Nami\n1x OP01-025\n');
    expect(toSimList([])).toBe('');
  });

  it('round-trips through the parser', () => {
    expect(parseDecklist(toSimList(parseDecklist(SIM_DECK).items)).items).toEqual(parseDecklist(SIM_DECK).items);
  });
});

describe('set prefixes', () => {
  it.each([
    ['OP-17', ['OP17']],
    ['OP14-EB04', ['OP14', 'EB04']],
    ['PRB-01', ['PRB01']],
    ['ST-22', ['ST22']],
    ['P', []],
    ['OTHER', []],
  ])('%s -> %j', (code, prefixes) => {
    expect(setCardPrefixes(code)).toEqual(prefixes);
  });

  it('separates a set from its special inserts', () => {
    expect(isOwnSetCard('OP17-005', 'OP-17')).toBe(true);
    expect(isOwnSetCard('EB04-007', 'OP-17')).toBe(false);
    expect(isOwnSetCard('EB04-007', 'OP14-EB04')).toBe(true);
    expect(isOwnSetCard('OP05-119', 'P')).toBe(true);
  });
});
