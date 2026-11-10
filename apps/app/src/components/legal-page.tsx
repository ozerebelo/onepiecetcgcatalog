import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatReleaseDate } from '@/lib/format';
import { CONTACT_EMAIL, LEGAL_UPDATED, OPERATOR_NAME } from '@/lib/legal';
import { spacing, usePalette } from '@/theme';

interface Section {
  title: string;
  body: string[];
}

/** A plain-language legal text (privacy policy or terms), from `legal.<doc>` in the locale file. */
export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const sections = t(`legal.${doc}.sections`, { returnObjects: true }) as Section[];
  const other = doc === 'privacy' ? 'terms' : 'privacy';

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Stack.Screen options={{ title: t(`legal.${doc}.title`) }} />
      <Text variant="title" accessibilityRole="header">
        {t(`legal.${doc}.title`)}
      </Text>
      <Text variant="caption" tone="secondary">
        {t('legal.updated', { date: formatReleaseDate(LEGAL_UPDATED, i18n.language, 'long') })}
      </Text>
      <Text>{t(`legal.${doc}.intro`)}</Text>

      {sections.map((section) => (
        <View key={section.title} style={[styles.section, { borderTopColor: palette.border }]}>
          <Text variant="heading" accessibilityRole="header">
            {section.title}
          </Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph}>{paragraph}</Text>
          ))}
        </View>
      ))}

      <View style={[styles.section, { borderTopColor: palette.border }]}>
        <Text variant="heading" accessibilityRole="header">
          {t('legal.contactTitle')}
        </Text>
        {OPERATOR_NAME ? <Text>{t('legal.operator', { name: OPERATOR_NAME })}</Text> : null}
        {CONTACT_EMAIL ? (
          <Text>{t('legal.contactEmail', { email: CONTACT_EMAIL })}</Text>
        ) : (
          <Text>
            {t('legal.contactForm')}{' '}
            <Link href="/feedback">
              <Text weight="semibold" style={styles.link}>
                {t('feedback.title')}
              </Text>
            </Link>
          </Text>
        )}
        <Link href={`/legal/${other}`}>
          <Text weight="semibold" style={styles.link}>
            {t(`legal.${other}.title`)}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  link: { textDecorationLine: 'underline' },
});
