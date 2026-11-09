import { describe, expect, it } from 'vitest';

import { diffDecklists, parseMetaDecks } from './meta';

const LIST = ['1xOP13-001', ...Array.from({ length: 12 }, (_, i) => `4xOP13-${String(i + 2).padStart(3, '0')}`), '2xOP13-020'].join('\n');

const entry = {
  slug: '2026-11-08-pomona-3rd-luffy',
  archetype: 'Blue/Purple Luffy',
  leader: 'op13-001',
  format: 'op17',
  event: 'Pomona Regionals',
  event_date: '2026-11-08',
  placement: 3,
  players: 512,
  source_name: 'OPTCG.GG',
  source_url: 'https://www.optcg.gg/deck-lists/example',
  list: LIST,
};

describe('parseMetaDecks', () => {
  it('accepts a valid entry and normalises the leader and format', () => {
    const { decks, errors } = parseMetaDecks([entry]);
    expect(errors).toEqual([]);
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ leader: 'OP13-001', format: 'OP17', placement: 3, player: null });
    expect(decks[0]!.items.reduce((n, i) => n + i.quantity, 0)).toBe(51);
  });

  it('reports every problem with the deck it belongs to', () => {
    const { decks, errors } = parseMetaDecks([
      { ...entry, slug: 'Bad Slug', source_url: 'http://x', placement: 0, list: '1xOP13-001\n5xOP13-002' },
      entry,
      entry,
    ]);
    expect(decks).toEqual([]);
    expect(errors).toEqual(
      expect.arrayContaining([
        'Bad Slug: slug must be lowercase letters, digits and dashes',
        'Bad Slug: source_url must be an https link to where the list was published',
        'Bad Slug: placement must be a positive whole number',
        'Bad Slug: the list has 5 cards besides the leader (expected 50)',
        'Bad Slug: OP13-002 ×5 (max 4)',
        '2026-11-08-pomona-3rd-luffy: duplicate slug',
      ]),
    );
  });

  it('needs the leader in the list exactly once', () => {
    const { errors } = parseMetaDecks([{ ...entry, leader: 'OP12-001' }]);
    expect(errors).toContain('2026-11-08-pomona-3rd-luffy: the list must contain the leader OP12-001 exactly once');
  });

  it('rejects anything but an array', () => {
    expect(parseMetaDecks({}).errors).toEqual(['The file must contain a JSON array of decks.']);
  });
});

describe('diffDecklists', () => {
  it('lists what to add and cut to match another list', () => {
    const mine = [
      { card_id: 'OP13-001', quantity: 1 },
      { card_id: 'OP13-002', quantity: 4 },
      { card_id: 'OP13-003', quantity: 2 },
    ];
    const theirs = [
      { card_id: 'OP13-001', quantity: 1 },
      { card_id: 'OP13-002', quantity: 2 },
      { card_id: 'OP13-004', quantity: 4 },
    ];
    expect(diffDecklists(mine, theirs)).toEqual({
      add: [{ card_id: 'OP13-004', quantity: 4 }],
      cut: [
        { card_id: 'OP13-002', quantity: 2 },
        { card_id: 'OP13-003', quantity: 2 },
      ],
      shared: 3,
    });
  });
});
