import { router, Stack, usePathname } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { sendFeedback } from '@/lib/api';
import { showToast } from '@/lib/notify';
import { errorMessage, isValidEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth';

/** A note to the people who run the app: what's broken, confusing or missing. */
export default function FeedbackScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const pathname = usePathname();
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 3) {
      setError(t('feedback.errors.empty'));
      return;
    }
    const reply = contact.trim();
    if (reply && !isValidEmail(reply)) {
      setError(t('auth.errors.emailInvalid'));
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendFeedback(text, user ? null : reply || null, pathname);
      showToast(t('feedback.sent'));
      if (router.canGoBack()) router.back();
      else router.replace('/account');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Stack.Screen options={{ title: t('feedback.title') }} />
      <Text variant="title" accessibilityRole="header">
        {t('feedback.title')}
      </Text>
      <Text tone="secondary">{t('feedback.lead')}</Text>
      <TextField
        label={t('feedback.message')}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
        maxLength={4000}
        style={{ minHeight: 140, textAlignVertical: 'top' }}
      />
      {user ? (
        <Text variant="caption" tone="secondary">
          {t('feedback.replyTo', { email: user.email })}
        </Text>
      ) : (
        <TextField
          label={t('feedback.contact')}
          hint={t('feedback.contactHint')}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
      )}
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('feedback.send')} icon="send" onPress={submit} loading={sending} />
    </Screen>
  );
}
