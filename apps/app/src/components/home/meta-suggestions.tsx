import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MetaDeckCard } from '@/components/meta-deck-card';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/panel';
import { fetchMetaProgress } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { useAuth } from '@/providers/auth';
import { spacing } from '@/theme';

/** Home: the meta decks your collection is closest to (hidden until there are meta lists). */
export function MetaSuggestions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const decks = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'progress', language],
    queryFn: () => fetchMetaProgress(language),
    enabled: Boolean(user),
  });
  const closest = [...(decks.data ?? [])].sort((a, b) => a.missing - b.missing || b.event_date.localeCompare(a.event_date)).slice(0, 3);
  if (closest.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        title={t('meta.closestTitle')}
        action={
          <Link href="/meta" asChild>
            <Button title={t('meta.seeAll')} variant="ghost" size="sm" trailingIcon="arrow-right" />
          </Link>
        }
      />
      <View style={styles.grid}>
        {closest.map((deck) => (
          <MetaDeckCard key={deck.id} deck={deck} signedIn />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
