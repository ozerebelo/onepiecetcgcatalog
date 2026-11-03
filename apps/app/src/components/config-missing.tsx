import { useTranslation } from 'react-i18next';

import { Screen } from './ui/screen';
import { Text } from './ui/text';

/** Shown instead of the app when the Supabase environment variables are missing. */
export function ConfigMissing() {
  const { t } = useTranslation();
  return (
    <Screen narrow edges={['top', 'bottom']}>
      <Text variant="title">{t('app.name')}</Text>
      <Text variant="heading">{t('config.missingTitle')}</Text>
      <Text tone="secondary">{t('config.missingBody')}</Text>
    </Screen>
  );
}
