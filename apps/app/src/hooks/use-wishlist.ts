import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addToWishlist, fetchWishlist, removeFromWishlist, wishlistDeckMissing } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';

import { collectionKeys } from './use-collection';

/** The wishlist in the app's card language. Lives under the collection's keys, so collection changes refresh it. */
export function useWishlist() {
  const { user } = useAuth();
  const [language] = useCardLanguage();
  return useQuery({
    queryKey: [...collectionKeys.all(user?.id ?? 'anon'), 'wishlist', language],
    queryFn: () => fetchWishlist(language),
    enabled: Boolean(user),
  });
}

function useRefreshWishlist() {
  const client = useQueryClient();
  const { user } = useAuth();
  return () => client.invalidateQueries({ queryKey: [...collectionKeys.all(user?.id ?? 'anon'), 'wishlist'] });
}

export function useAddToWishlist() {
  const refresh = useRefreshWishlist();
  return useMutation({ mutationFn: (printingId: string) => addToWishlist(printingId), onSuccess: refresh, onError: notifyError });
}

export function useRemoveFromWishlist() {
  const refresh = useRefreshWishlist();
  return useMutation({ mutationFn: (printingId: string) => removeFromWishlist(printingId), onSuccess: refresh, onError: notifyError });
}

/** Puts a deck's missing cards (in the card language) on the wishlist; resolves to how many cards. */
export function useWishlistDeckMissing() {
  const refresh = useRefreshWishlist();
  const [language] = useCardLanguage();
  return useMutation({
    mutationFn: (deckId: string) => wishlistDeckMissing(deckId, language),
    onSuccess: refresh,
    onError: notifyError,
  });
}
