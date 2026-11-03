import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { usePalette } from '@/theme';

/** Native (iOS / Android) tab bar. The web version lives in app-tabs.web.tsx. */
export default function AppTabs() {
  const palette = usePalette();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={palette.surface}
      indicatorColor={palette.surfaceAlt}
      labelStyle={{ selected: { color: palette.primary } }}
      iconColor={{ selected: palette.primary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.cards')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.stack" md="style" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sets">
        <NativeTabs.Trigger.Label>{t('tabs.sets')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t('tabs.account')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
