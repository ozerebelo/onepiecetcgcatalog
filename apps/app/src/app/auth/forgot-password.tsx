import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { errorMessage, isValidEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError(t('auth.errors.emailInvalid'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSentTo(email.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Text variant="title">{t('auth.resetTitle')}</Text>
      {sentTo ? (
        <Text tone="secondary" accessibilityLiveRegion="polite">
          {t('auth.resetSent', { email: sentTo })}
        </Text>
      ) : (
        <>
          <Text tone="secondary">{t('auth.resetBody')}</Text>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            error={error}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={submit}
          />
          <Button title={t('auth.sendResetLink')} onPress={submit} loading={submitting} disabled={!email} />
        </>
      )}
    </Screen>
  );
}
