import type { Language } from '@binder/core';
import { useTranslation } from 'react-i18next';

import { Segmented } from '@/components/ui/segmented';
import { useCardLanguage } from '@/lib/card-language';

/** English | Japanese: which cards the app shows. One setting for every screen. */
export function LanguageSwitch() {
  const { t } = useTranslation();
  const [language, setLanguage] = useCardLanguage();
  return (
    <Segmented<Language>
      accessibilityLabel={t('cardLanguage.label')}
      value={language}
      onChange={setLanguage}
      options={[
        { value: 'en', label: t('languages.short.en') },
        { value: 'ja', label: t('languages.short.ja') },
      ]}
    />
  );
}
