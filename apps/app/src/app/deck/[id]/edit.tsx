import { toSimList } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DeckEditor } from '@/components/deck-editor';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { fetchDeck, fetchDeckItems } from '@/lib/api';
import { useAuth } from '@/providers/auth';

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, initializing } = useAuth();
  const deck = useQuery({ queryKey: ['decks', user?.id, 'deck', id], queryFn: () => fetchDeck(id), enabled: Boolean(user) });
  const items = useQuery({ queryKey: ['decks', user?.id, 'items', id], queryFn: () => fetchDeckItems(id), enabled: Boolean(user) });

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;
  if (deck.isPending || items.isPending) return <LoadingView />;
  if (deck.isError || items.isError) return <ErrorView error={deck.error ?? items.error} />;
  if (!deck.data) return <EmptyView message={t('common.notFound')} />;

  return (
    <DeckEditor
      deckId={deck.data.id}
      initialName={deck.data.name}
      initialNotes={deck.data.notes ?? ''}
      initialList={toSimList(items.data)}
    />
  );
}
