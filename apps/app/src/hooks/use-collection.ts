import type { Language } from '@binder/core';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import {
  adjustCollectionQuantity,
  fetchCollectionQuantities,
  fetchCollectionSummary,
  fetchSetProgress,
  type QuantityMap,
} from '@/lib/api';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';

/**
 * React Query keys for collection data. Everything lives under ['collection', userId]
 * so signing out / switching accounts never shows someone else's numbers.
 */
export const collectionKeys = {
  all: (userId: string) => ['collection', userId] as const,
  quantities: (userId: string, scope: { setId?: string; cardId?: string }) =>
    ['collection', userId, 'quantities', scope.setId ?? null, scope.cardId ?? null] as const,
  summary: (userId: string) => ['collection', userId, 'summary'] as const,
  setProgress: (userId: string, language: Language) => ['collection', userId, 'set-progress', language] as const,
  search: (userId: string, params: unknown) => ['collection', userId, 'search', params] as const,
};

/** Owned quantities for a set or a card. Empty (and no request) when signed out. */
export function useCollectionQuantities(scope: { setId?: string; cardId?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: collectionKeys.quantities(user?.id ?? 'anon', scope),
    queryFn: () => fetchCollectionQuantities(scope),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });
}

export function useCollectionSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: collectionKeys.summary(user?.id ?? 'anon'),
    queryFn: fetchCollectionSummary,
    enabled: Boolean(user),
  });
}

export function useSetProgress(language: Language) {
  const { user } = useAuth();
  return useQuery({
    queryKey: collectionKeys.setProgress(user?.id ?? 'anon', language),
    queryFn: () => fetchSetProgress(language),
    enabled: Boolean(user),
  });
}

function patchQuantityMaps(client: QueryClient, userId: string, printingId: string, update: (old: number) => number) {
  client.setQueriesData<QuantityMap>({ queryKey: [...collectionKeys.all(userId), 'quantities'] }, (map) => {
    if (!map) return map;
    const next = Math.max(0, update(map[printingId] ?? 0));
    const copy = { ...map };
    if (next === 0) delete copy[printingId];
    else copy[printingId] = next;
    return copy;
  });
}

/** Marks the derived views (totals, collection list, set progress) as stale. */
export function invalidateCollectionViews(client: QueryClient, userId: string) {
  for (const view of ['summary', 'search', 'set-progress']) {
    client.invalidateQueries({ queryKey: [...collectionKeys.all(userId), view] });
  }
}

/**
 * +/- buttons. Updates the UI instantly (optimistic), sends an atomic delta to the
 * server, and only applies the server's number once the last pending tap for that
 * card has come back — so fast repeated taps never make the count jump around.
 */
export function useAdjustQuantity() {
  const client = useQueryClient();
  const { user } = useAuth();
  const pending = useRef(new Map<string, number>());

  return useMutation({
    mutationFn: ({ printingId, delta }: { printingId: string; delta: number }) =>
      adjustCollectionQuantity(printingId, delta),
    onMutate: ({ printingId, delta }) => {
      if (!user) return;
      pending.current.set(printingId, (pending.current.get(printingId) ?? 0) + 1);
      patchQuantityMaps(client, user.id, printingId, (old) => old + delta);
    },
    onSuccess: (quantity, { printingId }) => {
      if (!user) return;
      const left = (pending.current.get(printingId) ?? 1) - 1;
      pending.current.set(printingId, left);
      if (left <= 0) {
        pending.current.delete(printingId);
        patchQuantityMaps(client, user.id, printingId, () => quantity);
      }
      invalidateCollectionViews(client, user.id);
    },
    onError: (error, { printingId }) => {
      if (!user) return;
      pending.current.delete(printingId);
      client.invalidateQueries({ queryKey: collectionKeys.all(user.id) });
      notifyError(error);
    },
  });
}
