# Setup guide

Everything you need to go from this repository to a running app with real card data. Budget about
30–45 minutes the first time. All services used here have free tiers that are enough to launch.

**Accounts you'll create:** Supabase (database + logins), Vercel (website hosting), and later Expo
(app builds). Optional later: Apple Developer ($99/year) and Google Play ($25 once) to publish to
the stores.

---

## 0. Tools on your computer

- [Node.js 22+](https://nodejs.org)
- pnpm: run `corepack enable` once (it ships with Node)
- Git

Then, in the repository folder:

```bash
pnpm install
```

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) → **New project**. Pick the region closest to
   most of your users and save the database password somewhere safe.
2. When it's ready, open **Project Settings → API** (or the **Connect** button) and note:
   - **Project URL** — `https://<project-ref>.supabase.co`
   - **Publishable key** (`sb_publishable_…`; older projects call it the **anon** key)
   - Never use the **secret / service_role** key in the app.

## 2. Create the database schema

Recommended — with the Supabase CLI (runs via `npx`, nothing to install):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` applies every file in `supabase/migrations/` in order. Run it again whenever new migration
files are added (every phase will add some).

<details><summary>Alternative without the CLI</summary>

Open **SQL Editor** in the dashboard and run the contents of each file in `supabase/migrations/`,
oldest first (the file names start with a timestamp). If you go this way, keep doing it in order for
future migrations too — mixing methods makes the CLI's migration history inaccurate.
</details>

### Updating the database when a new version adds migrations

**Automatic:** once the `DATABASE_URL` secret is set (step 4), the **Update database & card data**
workflow applies any new files in `supabase/migrations/` whenever they reach `main` (and on every
daily run). It records them in the same history table the Supabase CLI uses; files you pasted into
the SQL Editor earlier are detected and recorded, not re-run. Manually: `DATABASE_URL=… pnpm db:migrate`.

| File | Added in |
|---|---|
| `20261103000100_catalog.sql`, `20261103000200_profiles.sql` | Phase 1 |
| `20261104000100_collection.sql` | Phase 2 — collections |
| `20261105000100_card_images.sql` | Card images served from your own storage |

## 3. Configure sign-in

In the dashboard, **Authentication → URL Configuration**:

- **Site URL**: your website address once deployed (step 6), e.g. `https://nakama-binder.vercel.app`.
  Use `http://localhost:8081` until then.
- **Redirect URLs** — add all of these:
  - `http://localhost:8081/**` (local web development)
  - `https://<your-vercel-domain>/**` (production web; add custom domains too)
  - `nakamabinder://**` (the iOS / Android app)
  - `exp://**` (testing in Expo Go)

**Authentication → Providers → Email**: keep **Confirm email** on.

> ⚠️ **Before inviting real users:** Supabase's built-in email sender is only meant for testing and is
> limited to a handful of emails per hour. Set up a real sender under **Authentication → Emails →
> SMTP Settings** (e.g. Resend, Postmark or Amazon SES — all have free tiers).

## 4. Import the card data

The importer needs a direct database connection string: **Connect → Session pooler** →
copy the URI and put your database password in it.

```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' pnpm ingest --fetch
```

This downloads the latest dataset into `.cache/` (git-ignored) and loads ~123 sets, ~2,900 cards and
~9,900 printings in a few seconds. It is safe to re-run: unchanged rows are skipped and nothing is
ever deleted (users may own cards that disappear from the official list).

Useful flags: `--dry-run` (no database needed, just prints what it would import),
`--languages en` (English only), `--source <dir>` (use an existing checkout).

### Keep it updated automatically

The workflow in `.github/workflows/ingest-cards.yml` re-imports every day. In the GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**:

- `DATABASE_URL` — the same connection string as above
- `DATABASE_CA_CERT` *(optional, recommended)* — the contents of the certificate from
  **Database Settings → SSL Configuration → Download certificate**. With it the importer verifies it is
  talking to your real database; without it the connection is still encrypted.

You can run it manually any time from the **Actions** tab → **Update database & card data** → **Run workflow**.

### Card images (copied into your Supabase Storage)

The official card-list site doesn't allow its images to be shown on other websites, so the import job
copies each image once into a public Storage bucket called `card-images` (resized to WebP, about
10× smaller than the originals). It needs one more repository secret:

- `SUPABASE_SECRET_KEY` — **Project Settings → API Keys → Secret keys** (`sb_secret_…`; older
  projects: the `service_role` key). It can write to your whole project: only ever store it as a
  GitHub secret, never in the app or in Vercel.

(The project URL is worked out from `DATABASE_URL`; set a `SUPABASE_URL` secret only if that fails.)

The first run copies all ~10,000 images (around 10–20 minutes); daily runs only copy new cards.
Storage use is roughly 0.4–0.6 GB, inside the free plan's 1 GB.

## 5. Run the app locally

```bash
cp apps/app/.env.example apps/app/.env.local
# edit apps/app/.env.local: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY

pnpm web     # opens the web app at http://localhost:8081
pnpm dev     # Expo dev server: press i / a for simulators, or scan the QR code with Expo Go
```

If the app shows **"Backend not configured"**, the two environment variables are missing — restart
the dev server after editing `.env.local`.

## 6. Deploy the website (Vercel)

1. Push the repository to GitHub (already done if you're reading this there).
2. On [vercel.com](https://vercel.com): **Add New → Project** → import the repository. Leave the root
   directory as the repository root — `vercel.json` already contains the build settings.
3. Under **Environment Variables** add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
4. **Deploy**. Then go back to step 3 and put the Vercel URL in Supabase's **Site URL** and
   **Redirect URLs**.

Every push to the main branch redeploys automatically; pull requests get preview URLs (add
`https://*-<your-team>.vercel.app/**` to the redirect URLs if you want sign-in to work on previews).

## 7. Mobile builds (when you're ready)

Builds run in the cloud with [EAS](https://docs.expo.dev/build/introduction/); no Mac needed for
Android.

```bash
cd apps/app
npx eas-cli@latest login
npx eas-cli@latest init                    # links the app to your Expo account
npx eas-cli@latest env:create              # add the two EXPO_PUBLIC_SUPABASE_* variables
npx eas-cli@latest build -p android --profile preview   # installable APK for testing
npx eas-cli@latest build -p ios --profile preview       # needs an Apple Developer account
```

The app identifiers are `com.nakamabinder.app` (iOS bundle id and Android package, in
`apps/app/app.json`). **Change them before the first store submission if you want a different name —
they cannot be changed afterwards.**

## 8. Tests

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Database tests (schema, security rules, search):

- With Docker: `npx supabase start` then `npx supabase test db`
- Without Docker (needs Postgres 15+ and pgTAP installed): `pnpm db:test`

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Backend not configured" | Set both `EXPO_PUBLIC_SUPABASE_*` variables and restart / redeploy. |
| Card list is empty | Run the import (step 4). Check **Table Editor → cards** has rows. |
| Confirmation email link opens a blank page / error | The link's URL isn't in **Redirect URLs** (step 3). |
| "Email rate limit exceeded" | Configure custom SMTP (step 3 warning). |
| Card images don't load | Check the last **Update database & card data** run: the `images:` line says how many were copied. Without the `SUPABASE_SECRET_KEY` secret images aren't copied (the log says "Image mirroring skipped"). |
| Import fails with a certificate error | Use the Session pooler URI; if you set `DATABASE_CA_CERT`, make sure it's the full PEM text. |
