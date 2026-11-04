import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { usePalette } from '@/theme';

/**
 * Native (iOS / Android) tab bar. The web version lives in app-tabs.web.tsx.
 * Sets is reachable from Home and the Cards screen, so it has no tab of its own
 * (iOS shows at most five tabs before folding the rest into "More").
 */
export default function AppTabs() {
  const palette = usePalette();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={palette.surface}
      indicatorColor={palette.primarySoft}
      labelStyle={{ selected: { color: palette.primary } }}
      iconColor={{ selected: palette.primary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cards">
        <NativeTabs.Trigger.Label>{t('tabs.cards')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.stack" md="style" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sets" hidden />
      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Label>{t('tabs.collection')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical" md="collections_bookmark" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="decks">
        <NativeTabs.Trigger.Label>{t('tabs.decks')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up" md="layers" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t('tabs.account')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
