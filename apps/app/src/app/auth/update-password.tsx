import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { createSessionFromUrl } from '@/lib/auth-links';
import { errorMessage, isValidPassword } from '@/lib/validation';
import { useAuth } from '@/providers/auth';

/** Landing page of the password-reset email link. */
export default function UpdatePasswordScreen() {
  const { t } = useTranslation();
  const { user, initializing, updatePassword } = useAuth();
  const url = Linking.useLinkingURL();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Native: the reset link opens the app with tokens in the URL; turn them into a session.
  useEffect(() => {
    createSessionFromUrl(url).then(setLinkError);
  }, [url]);

  if (initializing) return <LoadingView />;

  const submit = async () => {
    if (!isValidPassword(password)) {
      setError(t('auth.errors.passwordShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      router.replace('/account');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Text variant="title">{t('auth.updatePasswordTitle')}</Text>
      {linkError ? <Text tone="danger">{linkError}</Text> : null}
      {!user ? (
        <Text tone="secondary">{t('auth.waitingForLink')}</Text>
      ) : (
        <>
          <TextField
            label={t('auth.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            label={t('auth.confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
          />
          {error ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button title={t('auth.updatePassword')} onPress={submit} loading={submitting} />
        </>
      )}
    </Screen>
  );
}
