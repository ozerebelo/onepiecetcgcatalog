import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LanguageSwitch } from '@/components/language-switch';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { fonts, spacing, usePalette } from '@/theme';

/**
 * Home for an account with no cards and no decks yet: the three things to do, in order, each with
 * its way in. Replaced by the normal dashboard as soon as there is something to show.
 */
export function FirstRun({ latestSet }: { latestSet?: { id: string; code: string } | null }) {
  const { t } = useTranslation();
  return (
    <View style={styles.guide}>
      <Text variant="heading" accessibilityRole="header">
        {t('onboarding.title')}
      </Text>
      <Text tone="secondary">{t('onboarding.lead')}</Text>

      <Step number={1} title={t('onboarding.language.title')} body={t('onboarding.language.body')}>
        <LanguageSwitch />
      </Step>
      <Step number={2} title={t('onboarding.cards.title')} body={t('onboarding.cards.body')}>
        {latestSet ? (
          <Link href={{ pathname: '/set/[id]', params: { id: latestSet.id } }} asChild>
            <Button title={t('onboarding.cards.set', { code: latestSet.code })} icon="check-square" size="sm" />
          </Link>
        ) : null}
        <Link href="/cards" asChild>
          <Button title={t('onboarding.cards.sets')} variant="outline" size="sm" />
        </Link>
        <Link href="/collection/packs" asChild>
          <Button title={t('onboarding.cards.packs')} icon="package" variant="outline" size="sm" />
        </Link>
        <Link href="/collection/import" asChild>
          <Button title={t('onboarding.cards.import')} icon="upload" variant="outline" size="sm" />
        </Link>
      </Step>
      <Step number={3} title={t('onboarding.deck.title')} body={t('onboarding.deck.body')} last>
        <Link href="/deck/new" asChild>
          <Button title={t('onboarding.deck.check')} icon="check-square" variant="outline" size="sm" />
        </Link>
        <Link href="/meta" asChild>
          <Button title={t('onboarding.deck.meta')} icon="award" variant="outline" size="sm" />
        </Link>
      </Step>
    </View>
  );
}

function Step({ number, title, body, children, last = false }: { number: number; title: string; body: string; children: ReactNode; last?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.step, { borderTopColor: palette.rule }, last && { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.number, { color: palette.text }]}>{number}</Text>
      <View style={styles.body}>
        <Text variant="subheading">{title}</Text>
        <Text tone="secondary">{body}</Text>
        <View style={styles.actions}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: spacing.sm, maxWidth: 720 },
  step: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.lg, borderTopWidth: 2, marginTop: spacing.sm },
  number: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, width: 28 },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
