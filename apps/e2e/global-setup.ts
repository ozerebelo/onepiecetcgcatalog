import { SERVICE_KEY, SUPABASE_URL, USERS } from './env';

/**
 * Recreates the test accounts so every run starts with empty collections and no decks (deleting a
 * user cascades to its profile, collection and decks). Uses the local stack's admin API.
 */
export default async function globalSetup() {
  if (!SERVICE_KEY) throw new Error('Set E2E_SUPABASE_SERVICE_KEY to the local stack\'s service_role key (see apps/e2e/README.md).');
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SUPABASE_URL)) {
    throw new Error(`Refusing to reset users on ${SUPABASE_URL}: the browser tests only run against a local Supabase.`);
  }
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const admin = (path: string, init?: RequestInit) => fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, { ...init, headers });

  const listed = await admin('/users?per_page=1000');
  if (!listed.ok) throw new Error(`Listing users failed: HTTP ${listed.status} ${await listed.text()}`);
  const { users } = (await listed.json()) as { users: { id: string; email: string }[] };
  const ours = new Set<string>(Object.values(USERS).map((u) => u.email));
  // Also remove accounts left by the sign-up test.
  for (const user of users.filter((u) => ours.has(u.email) || u.email.startsWith('e2e-signup-'))) {
    const deleted = await admin(`/users/${user.id}`, { method: 'DELETE' });
    if (!deleted.ok) throw new Error(`Deleting ${user.email} failed: HTTP ${deleted.status}`);
  }
  for (const user of Object.values(USERS)) {
    const created = await admin('/users', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, password: user.password, email_confirm: true, user_metadata: { display_name: user.displayName } }),
    });
    if (!created.ok) throw new Error(`Creating ${user.email} failed: HTTP ${created.status} ${await created.text()}`);
  }
}
