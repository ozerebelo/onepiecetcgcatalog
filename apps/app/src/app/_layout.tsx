import '@/i18n';

import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { IBMPlexSansCondensed_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-condensed/600SemiBold';
import { IBMPlexSansCondensed_700Bold } from '@expo-google-fonts/ibm-plex-sans-condensed/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigMissing } from '@/components/config-missing';
import { OverlayHost } from '@/components/ui/overlays';
import { WebStackHeader } from '@/components/web-stack-header';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { setupWeb } from '@/lib/web-setup';
import { AuthProvider } from '@/providers/auth';
import { fonts, usePalette } from '@/theme';

setupWeb();
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = usePalette();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexSansCondensed_600SemiBold,
    IBMPlexSansCondensed_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Web: let the browser draw scrollbars and form controls to match the theme (dark track in dark mode).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = scheme === 'dark' ? 'dark' : 'light';
    }
  }, [scheme]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
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
              <RootStack />
              <OverlayHost />
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
        headerTitleStyle: { fontFamily: fonts.displayMedium, fontSize: 18 },
        headerTintColor: palette.text,
        // Website: keep the site navigation on detail pages (native apps use the native header).
        ...(Platform.OS === 'web' ? { header: (props) => <WebStackHeader {...props} /> } : null),
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="card/[id]" options={{ title: '' }} />
      <Stack.Screen name="set/[id]" options={{ title: '' }} />
      <Stack.Screen name="collection/import" options={{ title: t('import.title') }} />
      <Stack.Screen name="collection/packs" options={{ title: t('packs.title') }} />
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
