import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/logo';
import { LanguageSwitch } from '@/components/language-switch';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader, Panel } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { fetchLastCatalogUpdate } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { fonts, radius, spacing, usePalette } from '@/theme';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { user, initializing, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const lastUpdate = useQuery({ queryKey: ['catalog-updated'], queryFn: fetchLastCatalogUpdate });

  if (initializing) return <LoadingView />;

  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? null;
  const initial = (displayName || user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <Screen scroll narrow>
      <PageHeader title={t('account.title')} />

      {/* The one place that explains the language switch shown on Cards, Collection and Decks. */}
      <Panel style={styles.language}>
        <View style={styles.flex}>
          <Text variant="heading">{t('cardLanguage.label')}</Text>
          <Text tone="secondary">{t('cardLanguage.accountHint')}</Text>
        </View>
        <LanguageSwitch />
      </Panel>

      {user ? (
        <>
          <Panel style={styles.profile}>
            <View style={[styles.avatar, { borderColor: palette.text }]}>
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 24, color: palette.text }}>{initial}</Text>
            </View>
            <View style={styles.flex}>
              {displayName ? <Text variant="heading">{displayName}</Text> : null}
              <Text tone="secondary">{t('account.signedInAs', { email: user.email })}</Text>
            </View>
          </Panel>

          <Panel padded={false}>
            <MenuLink href="/collection" icon="book-open" label={t('tabs.collection')} />
            <MenuLink href="/decks" icon="copy" label={t('tabs.decks')} />
            <MenuLink href="/collection/import" icon="upload" label={t('collection.import')} />
            <MenuLink href="/cards" icon="grid" label={t('tabs.cards')} last />
          </Panel>

          <Button
            title={t('account.signOut')}
            icon="log-out"
            variant="outline"
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
        <Panel>
          <LogoMark size={44} />
          <Text variant="heading">{t('account.signedOutTitle')}</Text>
          <Text tone="secondary">{t('account.signedOutBody')}</Text>
          <Link href="/auth/sign-up" asChild>
            <Button title={t('account.signUp')} />
          </Link>
          <Link href="/auth/sign-in" asChild>
            <Button title={t('account.signIn')} variant="outline" />
          </Link>
        </Panel>
      )}

      <View style={styles.footer}>
        {lastUpdate.data ? (
          <View style={styles.row}>
            <Icon name="refresh-cw" size={13} color={palette.textMuted} />
            <Text variant="caption" tone="muted">
              {t('account.catalogUpdated', {
                date: new Date(lastUpdate.data).toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
              })}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('account.about')}
        </Text>
      </View>
    </Screen>
  );
}

function MenuLink({ href, icon, label, last = false }: { href: '/collection' | '/decks' | '/collection/import' | '/cards'; icon: IconName; label: string; last?: boolean }) {
  const palette = usePalette();
  return (
    <Link href={href} asChild>
      <PressableArea
        accessibilityRole="link"
        boxStyle={[styles.menuItem, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.surfaceAlt }}>
        <Icon name={icon} size={18} color={palette.textSecondary} />
        <Text weight="medium" style={styles.flex}>
          {label}
        </Text>
        <Icon name="chevron-right" size={18} color={palette.textMuted} />
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  language: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  flex: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2, borderRadius: radius.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
