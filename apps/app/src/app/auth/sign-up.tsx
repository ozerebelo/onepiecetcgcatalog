import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { errorMessage, isValidDisplayName, isValidEmail, isValidPassword } from '@/lib/validation';
import { useAuth } from '@/providers/auth';

type FieldErrors = Partial<Record<'displayName' | 'email' | 'password' | 'confirm', string>>;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { user, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (user) return <Redirect href="/account" />;

  if (sentTo) {
    return (
      <Screen scroll narrow edges={['bottom']}>
        <Text variant="title">{t('auth.checkEmailTitle')}</Text>
        <Text tone="secondary">{t('auth.checkEmailBody', { email: sentTo })}</Text>
        <Link href="/auth/sign-in" replace asChild>
          <Button title={t('account.signIn')} variant="secondary" />
        </Link>
      </Screen>
    );
  }

  const submit = async () => {
    const errors: FieldErrors = {};
    if (!isValidDisplayName(displayName)) errors.displayName = t('auth.errors.displayNameRequired');
    if (!isValidEmail(email)) errors.email = t('auth.errors.emailInvalid');
    if (!isValidPassword(password)) errors.password = t('auth.errors.passwordShort');
    if (password !== confirm) errors.confirm = t('auth.errors.passwordMismatch');
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { needsConfirmation } = await signUp(email, password, displayName);
      if (needsConfirmation) setSentTo(email.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Text variant="title">{t('auth.signUpTitle')}</Text>
      <TextField
        label={t('auth.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        error={fieldErrors.displayName}
        autoComplete="nickname"
        maxLength={50}
      />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        error={fieldErrors.confirm}
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
      <Button title={t('account.signUp')} onPress={submit} loading={submitting} />
      <Link href="/auth/sign-in" replace asChild>
        <PressableArea accessibilityRole="link">
          <Text tone="primary">{t('auth.haveAccount')}</Text>
        </PressableArea>
      </Link>
    </Screen>
  );
}
