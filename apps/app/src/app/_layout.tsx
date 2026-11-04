import '@/i18n';

import { Epilogue_400Regular } from '@expo-google-fonts/epilogue/400Regular';
import { Epilogue_500Medium } from '@expo-google-fonts/epilogue/500Medium';
import { Epilogue_600SemiBold } from '@expo-google-fonts/epilogue/600SemiBold';
import { Epilogue_700Bold } from '@expo-google-fonts/epilogue/700Bold';
import { Epilogue_900Black } from '@expo-google-fonts/epilogue/900Black';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigMissing } from '@/components/config-missing';
import { WebShell } from '@/components/web-shell';
import { WebStackHeader } from '@/components/web-stack-header';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { setupWeb, webFontsReady } from '@/lib/web-setup';
import { AuthProvider } from '@/providers/auth';
import { fonts, usePalette } from '@/theme';

setupWeb();
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = usePalette();
  // Native: one family per weight. Web: one "Epilogue" family registered by setupWeb().
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === 'web'
      ? {}
      : { Epilogue_400Regular, Epilogue_500Medium, Epilogue_600SemiBold, Epilogue_700Bold, Epilogue_900Black },
  );
  const [webFonts, setWebFonts] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS === 'web') webFontsReady().finally(() => setWebFonts(true));
  }, []);
  const ready = (fontsLoaded || Boolean(fontError)) && webFonts;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.surface,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {isSupabaseConfigured ? (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <WebShell>
                <RootStack />
              </WebShell>
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
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: t('common.back'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { ...fonts.semibold, fontSize: 17 },
        headerTintColor: palette.text,
        // Website: keep the site navigation on detail pages (native apps use the native header).
        ...(Platform.OS === 'web' ? { header: (props) => <WebStackHeader {...props} /> } : null),
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="card/[id]" options={{ title: '' }} />
      <Stack.Screen name="set/[id]" options={{ title: '' }} />
      <Stack.Screen name="collection/import" options={{ title: t('import.title') }} />
      <Stack.Screen name="deck/new" options={{ title: t('decks.newTitle') }} />
      <Stack.Screen name="deck/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="deck/[id]/edit" options={{ title: t('decks.editTitle') }} />
      <Stack.Screen name="auth/sign-in" options={{ title: t('account.signIn') }} />
      <Stack.Screen name="auth/sign-up" options={{ title: t('account.signUp') }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: t('auth.resetTitle') }} />
      <Stack.Screen name="auth/update-password" options={{ title: t('auth.updatePasswordTitle') }} />
      <Stack.Screen name="auth/callback" options={{ title: '' }} />
    </Stack>
  );
}
