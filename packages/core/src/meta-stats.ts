import { DECK_SIZE, type DeckItem } from './deck';
import { diffDecklists } from './meta';

/**
 * Meta statistics, computed from the reference tournament lists: which leaders are winning, what every
 * list of a leader plays (its core), the "consensus" list built from the most common choices, and the
 * distinct builds players bring.
 */

export interface MetaList {
  id: string;
  leader: string;
  event: string;
  event_date: string;
  placement: number | null;
  players: number | null;
  /** The whole list, leader included. */
  items: DeckItem[];
}

export interface LeaderStanding {
  leader: string;
  lists: MetaList[];
  /** Share of all reference lists (0..1). */
  share: number;
  /** First places. */
  wins: number;
  /** Best placement reached (null when unknown). */
  best: number | null;
  /** Newest event date among its lists. */
  latest: string;
}

/** Leaders ranked by how many top lists they have, then by wins, best result and recency. */
export function rankLeaders(lists: readonly MetaList[]): LeaderStanding[] {
  const byLeader = new Map<string, MetaList[]>();
  for (const list of lists) byLeader.set(list.leader, [...(byLeader.get(list.leader) ?? []), list]);
  const total = lists.length || 1;
  return [...byLeader]
    .map(([leader, own]) => {
      const placements = own.map((l) => l.placement).filter((p): p is number => p != null);
      return {
        leader,
        lists: [...own].sort(byResult),
        share: own.length / total,
        wins: placements.filter((p) => p === 1).length,
        best: placements.length ? Math.min(...placements) : null,
        latest: own.map((l) => l.event_date).sort().at(-1) ?? '',
      };
    })
    .sort(
      (a, b) =>
        b.lists.length - a.lists.length ||
        b.wins - a.wins ||
        (a.best ?? 999) - (b.best ?? 999) ||
        b.latest.localeCompare(a.latest) ||
        a.leader.localeCompare(b.leader),
    );
}

/** Best placement first, then newest. */
function byResult(a: MetaList, b: MetaList) {
  return (a.placement ?? 999) - (b.placement ?? 999) || b.event_date.localeCompare(a.event_date);
}

export type UsageTier = 'core' | 'flex' | 'tech';

export interface CardUsage {
  card_id: string;
  /** Lists that play it. */
  lists: number;
  /** Share of the leader's lists that play it (0..1). */
  rate: number;
  /** Average copies among the lists that play it. */
  average: number;
  /** The most common number of copies (ties go to more copies). */
  usual: number;
  tier: UsageTier;
}

/** Played by at least 80% of lists: the core. 30–80%: flex slots. Less: tech choices. */
export const CORE_RATE = 0.8;
export const FLEX_RATE = 0.3;

export function usageTier(rate: number): UsageTier {
  return rate >= CORE_RATE ? 'core' : rate >= FLEX_RATE ? 'flex' : 'tech';
}

/** How often each card (leader excluded) appears across one leader's lists. */
export function cardUsage(lists: readonly MetaList[]): CardUsage[] {
  const counts = new Map<string, number[]>();
  for (const list of lists) {
    for (const item of list.items) {
      if (item.card_id === list.leader) continue;
      counts.set(item.card_id, [...(counts.get(item.card_id) ?? []), item.quantity]);
    }
  }
  const total = lists.length || 1;
  return [...counts]
    .map(([card_id, copies]) => {
      const rate = copies.length / total;
      const tally = new Map<number, number>();
      for (const c of copies) tally.set(c, (tally.get(c) ?? 0) + 1);
      const usual = [...tally].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
      return {
        card_id,
        lists: copies.length,
        rate,
        average: copies.reduce((n, c) => n + c, 0) / copies.length,
        usual,
        tier: usageTier(rate),
      };
    })
    .sort((a, b) => b.rate - a.rate || b.average - a.average || a.card_id.localeCompare(b.card_id));
}

/**
 * The list most players would recognise: the leader, then the most-played cards at their usual copy
 * counts, until the deck holds exactly 50 cards (the last pick is trimmed to fit).
 */
export function consensusList(leader: string, usage: readonly CardUsage[]): DeckItem[] {
  const items: DeckItem[] = [{ card_id: leader, quantity: 1 }];
  let room = DECK_SIZE;
  for (const card of usage) {
    if (room <= 0) break;
    const quantity = Math.min(card.usual, room);
    items.push({ card_id: card.card_id, quantity });
    room -= quantity;
  }
  return items;
}

export interface MetaBuild {
  /** The lists in this build, best result first. */
  lists: MetaList[];
  /** The build's own consensus list. */
  consensus: DeckItem[];
  /** How it differs from the leader's overall consensus. */
  diff: { add: DeckItem[]; cut: DeckItem[] };
}

/**
 * Groups a leader's lists into builds: a list joins the first build whose consensus shares at least
 * `minShared` cards with it (leader included), otherwise it starts a new build. Lists are taken best
 * result first, so each build is anchored by its strongest finish. Builds are ordered by size.
 */
export function groupBuilds(leader: string, lists: readonly MetaList[], minShared = 40): MetaBuild[] {
  const overall = consensusList(leader, cardUsage(lists));
  const groups: MetaList[][] = [];
  for (const list of [...lists].sort(byResult)) {
    const home = groups.find((g) => diffDecklists(list.items, consensusList(leader, cardUsage(g))).shared >= minShared);
    if (home) home.push(list);
    else groups.push([list]);
  }
  return groups
    .map((g) => {
      const consensus = consensusList(leader, cardUsage(g));
      const { add, cut } = diffDecklists(overall, consensus);
      return { lists: g, consensus, diff: { add, cut } };
    })
    .sort((a, b) => b.lists.length - a.lists.length || byResult(a.lists[0]!, b.lists[0]!));
}
