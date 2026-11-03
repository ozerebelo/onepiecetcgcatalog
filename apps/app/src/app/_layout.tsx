import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigMissing } from '@/components/config-missing';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { setupWeb } from '@/lib/web-setup';
import { AuthProvider } from '@/providers/auth';
import { usePalette } from '@/theme';

setupWeb();

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = usePalette();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {isSupabaseConfigured ? (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootStack />
            </AuthProvider>
          </QueryClientProvider>
        ) : (
          <ConfigMissing />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="card/[id]" options={{ title: '' }} />
      <Stack.Screen name="set/[id]" options={{ title: '' }} />
      <Stack.Screen name="collection/import" options={{ title: t('import.title') }} />
      <Stack.Screen name="auth/sign-in" options={{ title: t('account.signIn') }} />
      <Stack.Screen name="auth/sign-up" options={{ title: t('account.signUp') }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: t('auth.resetTitle') }} />
      <Stack.Screen name="auth/update-password" options={{ title: t('auth.updatePasswordTitle') }} />
      <Stack.Screen name="auth/callback" options={{ title: '' }} />
    </Stack>
  );
}
