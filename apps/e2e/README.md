# Browser tests

Playwright tests that drive the exported web app against a **real local Supabase** (database, auth,
API and the Mailpit test inbox). CI runs them on every push to `main` and on pull requests
(`.github/workflows/ci.yml`, job *Browser tests*).

What they cover: the Cards page (sections, search, type filters, alt-art names), card and set pages,
sign-in / sign-up validation, the full sign-up → branded confirmation email → sign-in flow, the
collection journey (collect mode, steppers, import preview, CSV / list export, restore from backup)
and the deck check (missing cards, copy as Sim list). Phone-sized Chromium for most, desktop for the
top bar and infinite scroll. Any console error fails a test.

## Run them locally

Needs Docker and the Supabase CLI (`npx supabase` works).

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,supavisor
```

```bash
git clone https://github.com/buhbbl/punk-records.git .cache/punk-records
git -C .cache/punk-records checkout dfa5297c577f1532b13db08da90e2b99818a8b79
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm ingest --source "$PWD/.cache/punk-records"
```

```bash
eval "$(npx supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_KEY=$ANON_KEY pnpm build:web
E2E_SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY pnpm e2e
```

The card counts in the tests (e.g. 39 cards match "zoro") belong to that pinned data revision; when
you move the pin in `ci.yml`, update them. Each run deletes and recreates its test accounts
(`nami@` / `robin@example.com`), and refuses to touch anything but a local Supabase.

Useful: `pnpm --filter @binder/e2e e2e --ui` (watch mode), `--project=desktop`, and
`npx playwright show-trace apps/e2e/test-results/<test>/trace.zip` after a failure. Sent emails are
visible at http://127.0.0.1:54324.
