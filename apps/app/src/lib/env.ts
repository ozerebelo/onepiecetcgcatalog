/**
 * Public runtime configuration. EXPO_PUBLIC_* variables are inlined into the
 * bundle at build time, so only put values here that are safe to ship to every
 * user (the Supabase URL and publishable/anon key are — RLS protects the data).
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
};

export const isSupabaseConfigured = env.supabaseUrl.startsWith('http') && env.supabaseKey.length > 0;
