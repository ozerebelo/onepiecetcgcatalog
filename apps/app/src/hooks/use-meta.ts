import { cardUsage, consensusList, rankLeaders, type DeckItem, type LeaderStanding } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchMetaCardInfo, fetchMetaLists, type MetaCardInfo } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { useAuth } from '@/providers/auth';

export interface LeaderMeta extends LeaderStanding {
  /** The leader's consensus list (leader + 50). */
  consensus: DeckItem[];
  /** Copies of the consensus you own (in the app's card language). */
  have: number;
  needed: number;
  missing: number;
}

/** How many copies of a list you own, card by card (capped at what the list needs). */
export function ownedOf(items: readonly DeckItem[], cards: Record<string, MetaCardInfo> | undefined) {
  const needed = items.reduce((n, i) => n + i.quantity, 0);
  const have = items.reduce((n, i) => n + Math.min(i.quantity, cards?.[i.card_id]?.owned ?? 0), 0);
  return { needed, have, missing: needed - have };
}

/**
 * The meta, by leader: standings (most top lists first), each leader's consensus list and how much of it
 * you own, plus card details for drawing everything.
 */
export function useMeta() {
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const lists = useQuery({ queryKey: ['meta', 'lists'], queryFn: fetchMetaLists });
  const cards = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'cards', language],
    queryFn: () => fetchMetaCardInfo(language),
  });

  const leaders = useMemo<LeaderMeta[]>(() => {
    if (!lists.data) return [];
    return rankLeaders(lists.data).map((standing) => {
      const consensus = consensusList(standing.leader, cardUsage(standing.lists));
      return { ...standing, consensus, ...ownedOf(consensus, cards.data) };
    });
  }, [lists.data, cards.data]);

  return {
    lists,
    cards,
    leaders,
    isPending: lists.isPending || cards.isPending,
    isError: lists.isError || cards.isError,
    error: lists.error ?? cards.error,
    refetch: () => Promise.all([lists.refetch(), cards.refetch()]),
  };
}
