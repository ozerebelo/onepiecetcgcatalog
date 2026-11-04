import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { DeckList } from '@/components/deck-list';
import { Button } from '@/components/ui/button';
import { PageHeader, Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { fetchDeckSummaries } from '@/lib/api';
import { useAuth } from '@/providers/auth';

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
        <PageHeader title={t('decks.title')} />
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
        title={t('decks.title')}
        subtitle={t('decks.subtitle')}
        actions={
          <Link href="/deck/new" asChild>
            <Button title={t('decks.new')} icon="plus" size="sm" />
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
        <DeckList decks={decks.data} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignSelf: 'center' },
});
