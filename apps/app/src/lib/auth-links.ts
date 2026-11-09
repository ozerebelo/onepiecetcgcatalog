import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';

/**
 * Where Supabase should send users back to after clicking an email link.
 * Web: https://<site>/<path>; native: yonko://<path> (exp://... in Expo Go).
 * Every value produced here must be listed under Auth → URL Configuration →
 * Redirect URLs in the Supabase dashboard (see docs/SETUP.md).
 */
export function authRedirectUrl(path: string): string {
  return Linking.createURL(path);
}

/** Reads auth tokens (or an auth error) from a redirect URL's fragment or query string. */
export function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash?.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    for (const [key, value] of new URLSearchParams(part)) params[key] = value;
  }
  return params;
}

/**
 * Turns the tokens in an email-link redirect into a signed-in session.
 * On web supabase-js does this itself (detectSessionInUrl), so this is a no-op there.
 * Returns an error message to display, or null.
 */
export async function createSessionFromUrl(url: string | null): Promise<string | null> {
  if (Platform.OS === 'web' || !url) return null;
  const params = parseAuthParams(url);
  if (params.error_description || params.error) {
    return params.error_description ?? params.error ?? 'Authentication failed';
  }
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;
  const { error } = await getSupabase().auth.setSession({ access_token, refresh_token });
  return error?.message ?? null;
}
