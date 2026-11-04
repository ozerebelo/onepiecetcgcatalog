import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DeckCard } from '@/components/deck-card';
import { Button } from '@/components/ui/button';
import { PageHeader, Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { fetchDeckSummaries } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { spacing } from '@/theme';

export default function DecksScreen() {
  const { t } = useTranslation();
  const { user, initializing } = useAuth();
  const decks = useQuery({
    queryKey: ['decks', user?.id ?? 'anon', 'summaries', null],
    queryFn: () => fetchDeckSummaries(null),
    enabled: Boolean(user),
  });

  if (initializing) return <LoadingView />;

  if (!user) {
    return (
      <Screen scroll narrow>
        <PageHeader eyebrow={t('decks.eyebrow')} title={t('decks.title')} />
        <Panel>
          <Text variant="heading">{t('decks.signedOutTitle')}</Text>
          <Text tone="secondary">{t('decks.signedOutBody')}</Text>
          <Link href="/auth/sign-up" asChild>
            <Button title={t('account.signUp')} />
          </Link>
          <Link href="/auth/sign-in" asChild>
            <Button title={t('account.signIn')} variant="outline" />
          </Link>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PageHeader
        eyebrow={t('decks.eyebrow')}
        title={t('decks.title')}
        subtitle={t('decks.subtitle')}
        actions={
          <Link href="/deck/new" asChild>
            <Button title={t('decks.new')} icon="plus" />
          </Link>
        }
      />
      {decks.isPending ? (
        <LoadingView />
      ) : decks.isError ? (
        <ErrorView error={decks.error} onRetry={() => decks.refetch()} />
      ) : decks.data.length === 0 ? (
        <Panel>
          <EmptyView icon="copy" title={t('decks.emptyTitle')} message={t('decks.emptyBody')} />
          <Link href="/deck/new" asChild>
            <Button title={t('decks.new')} icon="plus" boxStyle={styles.center} />
          </Link>
        </Panel>
      ) : (
        <View style={styles.grid}>
          {decks.data.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  center: { alignSelf: 'center' },
});
