import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MetaLeaderRow } from '@/components/meta-leader-row';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/panel';
import { useMeta } from '@/hooks/use-meta';
import { spacing } from '@/theme';

/** Home: the meta leaders whose consensus list your collection is closest to (hidden until there's a meta). */
export function MetaSuggestions() {
  const { t } = useTranslation();
  const meta = useMeta();
  const maxShare = meta.leaders[0]?.share ?? 0;
  const ranked = meta.leaders.map((leader, i) => ({ leader, rank: i + 1 }));
  const closest = ranked.sort((a, b) => a.leader.missing - b.leader.missing || a.rank - b.rank).slice(0, 3);
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
      <View style={styles.list}>
        {closest.map(({ leader, rank }) => (
          <MetaLeaderRow key={leader.leader} rank={rank} leader={leader} info={meta.cards.data?.[leader.leader]} maxShare={maxShare} signedIn />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  list: { maxWidth: 880 },
});
