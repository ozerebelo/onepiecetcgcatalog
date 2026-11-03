import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from './env';

let client: SupabaseClient | null = null;

/**
 * The shared Supabase client. Sessions are persisted in AsyncStorage on native
 * (localStorage on web). On web, auth redirects (email confirmation, password
 * reset) put tokens in the URL and supabase-js picks them up automatically;
 * on native the deep-link handler in lib/auth-links.ts does it.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');
  }
  if (!client) {
    const isWeb = Platform.OS === 'web';
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        // During static rendering on the server there is no window/storage.
        storage: isWeb && typeof window === 'undefined' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: isWeb,
      },
    });

    if (!isWeb) {
      // Only refresh tokens while the app is in the foreground.
      AppState.addEventListener('change', (state) => {
        if (state === 'active') client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
