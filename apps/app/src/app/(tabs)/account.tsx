import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { fetchLastCatalogUpdate } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { radius, spacing, usePalette } from '@/theme';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { user, initializing, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const lastUpdate = useQuery({ queryKey: ['catalog-updated'], queryFn: fetchLastCatalogUpdate });

  if (initializing) return <LoadingView />;

  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? null;

  return (
    <Screen scroll narrow>
      <Text variant="title">{t('account.title')}</Text>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {user ? (
          <>
            {displayName ? <Text variant="heading">{displayName}</Text> : null}
            <Text tone="secondary">{t('account.signedInAs', { email: user.email })}</Text>
            <Text variant="caption" tone="secondary">
              {t('account.comingSoon')}
            </Text>
            <Button
              title={t('account.signOut')}
              variant="secondary"
              loading={signingOut}
              onPress={async () => {
                setSigningOut(true);
                try {
                  await signOut();
                } finally {
                  setSigningOut(false);
                }
              }}
            />
          </>
        ) : (
          <>
            <Text variant="heading">{t('account.signedOutTitle')}</Text>
            <Text tone="secondary">{t('account.signedOutBody')}</Text>
            <Link href="/auth/sign-in" asChild>
              <Button title={t('account.signIn')} />
            </Link>
            <Link href="/auth/sign-up" asChild>
              <Button title={t('account.signUp')} variant="secondary" />
            </Link>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {lastUpdate.data ? (
          <Text variant="caption" tone="muted">
            {t('account.catalogUpdated', {
              date: new Date(lastUpdate.data).toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
            })}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('account.about')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  footer: { gap: spacing.sm },
});
