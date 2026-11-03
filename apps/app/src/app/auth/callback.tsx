import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';
import { LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { createSessionFromUrl } from '@/lib/auth-links';
import { useAuth } from '@/providers/auth';

/** Landing page of the sign-up confirmation email link. */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createSessionFromUrl(url).then(setError);
  }, [url]);

  if (user) return <Redirect href="/account" />;

  return (
    <Screen narrow edges={['bottom']}>
      {error ? (
        <Text tone="danger">{error}</Text>
      ) : (
        <>
          <Text tone="secondary">{t('auth.confirming')}</Text>
          <LoadingView />
        </>
      )}
    </Screen>
  );
}
