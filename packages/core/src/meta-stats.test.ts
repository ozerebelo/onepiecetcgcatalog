import { describe, expect, it } from 'vitest';

import { cardUsage, consensusList, groupBuilds, rankLeaders, usageTier, type MetaList } from './meta-stats';

/** A 51-card list: leader + 12 cards ×4 + a 2-of, with optional swaps. */
function list(id: string, leader: string, cards: string[], extra: [string, number], placement: number | null, date = '2026-11-01'): MetaList {
  return {
    id,
    leader,
    event: `Event ${id}`,
    event_date: date,
    placement,
    players: 64,
    items: [{ card_id: leader, quantity: 1 }, ...cards.map((c) => ({ card_id: c, quantity: 4 })), { card_id: extra[0], quantity: extra[1] }],
  };
}

const base = Array.from({ length: 12 }, (_, i) => `OP13-${String(i + 10).padStart(3, '0')}`);
const variant = [...base.slice(0, 9), 'OP17-001', 'OP17-002', 'OP17-003'];

const luffyA = list('a', 'OP13-001', base, ['EB05-001', 2], 1);
const luffyB = list('b', 'OP13-001', base, ['EB05-002', 2], 3, '2026-11-08');
const luffyC = list('c', 'OP13-001', variant, ['EB05-001', 2], 2);
const xebec = list('x', 'OP17-039', base, ['EB05-001', 2], 1, '2026-11-08');
const law = list('l', 'OP14-001', base, ['EB05-001', 2], 4);

describe('rankLeaders', () => {
  it('ranks by number of lists, then wins and best result', () => {
    const ranked = rankLeaders([law, xebec, luffyA, luffyB, luffyC]);
    expect(ranked.map((r) => [r.leader, r.lists.length, r.wins, r.best])).toEqual([
      ['OP13-001', 3, 1, 1],
      ['OP17-039', 1, 1, 1],
      ['OP14-001', 1, 0, 4],
    ]);
    expect(ranked[0]!.share).toBeCloseTo(0.6);
    expect(ranked[0]!.lists.map((l) => l.id)).toEqual(['a', 'c', 'b']);
    expect(ranked[0]!.latest).toBe('2026-11-08');
  });
});

describe('cardUsage', () => {
  it('counts how many lists play each card and its usual copies', () => {
    const usage = cardUsage([luffyA, luffyB, luffyC]);
    const byId = Object.fromEntries(usage.map((u) => [u.card_id, u]));
    expect(byId['OP13-010']).toMatchObject({ lists: 3, rate: 1, usual: 4, tier: 'core' });
    expect(byId['OP13-019']).toMatchObject({ lists: 2, tier: 'flex' });
    expect(byId['EB05-001']).toMatchObject({ lists: 2, usual: 2 });
    expect(byId['OP17-001']).toMatchObject({ lists: 1, tier: 'flex' });
    expect(usage.find((u) => u.card_id === 'OP13-001')).toBeUndefined();
    expect(usage[0]!.rate).toBe(1);
  });

  it('tiers by play rate', () => {
    expect([usageTier(1), usageTier(0.8), usageTier(0.5), usageTier(0.2)]).toEqual(['core', 'core', 'flex', 'tech']);
  });
});

describe('consensusList', () => {
  it('is the leader plus exactly 50 cards of the most played choices', () => {
    const consensus = consensusList('OP13-001', cardUsage([luffyA, luffyB, luffyC]));
    expect(consensus[0]).toEqual({ card_id: 'OP13-001', quantity: 1 });
    expect(consensus.reduce((n, i) => n + i.quantity, 0)).toBe(51);
    expect(consensus.map((i) => i.card_id)).toContain('OP13-019');
    expect(consensus.map((i) => i.card_id)).not.toContain('OP17-001');
  });
});

describe('groupBuilds', () => {
  it('puts near-identical lists together and splits a different build', () => {
    const builds = groupBuilds('OP13-001', [luffyA, luffyB, luffyC]);
    expect(builds.map((b) => b.lists.map((l) => l.id))).toEqual([['a', 'b'], ['c']]);
    expect(builds[1]!.diff.add.map((i) => i.card_id)).toEqual(['OP17-001', 'OP17-002', 'OP17-003']);
    expect(builds[0]!.diff.add).toEqual([]);
  });
});
