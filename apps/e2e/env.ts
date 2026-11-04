/** Where the tests find the app and the local Supabase. Defaults match `supabase start` and serve.mjs. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8099';
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
/** The local stack's service_role key (`supabase status -o env` → SERVICE_ROLE_KEY). Local only — never a hosted key. */
export const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? '';
/** Mailpit, the local stack's test inbox. */
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** Accounts created fresh before every run (one per spec that changes data, so specs can run in parallel). */
export const USERS = {
  collector: { email: 'nami@example.com', password: 'e2e-nami-password', displayName: 'Nami' },
  deckbuilder: { email: 'robin@example.com', password: 'e2e-robin-password', displayName: 'Robin' },
} as const;
