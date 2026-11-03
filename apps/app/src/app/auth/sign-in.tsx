import { Link, Redirect } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { errorMessage, isValidEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (user) return <Redirect href="/account" />;

  const submit = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setEmailError(t('auth.errors.emailInvalid'));
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // The <Redirect> above takes over once the session is set.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Text variant="title">{t('auth.signInTitle')}</Text>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('account.signIn')} onPress={submit} loading={submitting} disabled={!email || !password} />
      <Link href="/auth/forgot-password" asChild>
        <PressableArea accessibilityRole="link">
          <Text tone="primary">{t('auth.forgotPassword')}</Text>
        </PressableArea>
      </Link>
      <Link href="/auth/sign-up" replace asChild>
        <PressableArea accessibilityRole="link">
          <Text tone="primary">{t('auth.noAccount')}</Text>
        </PressableArea>
      </Link>
    </Screen>
  );
}
