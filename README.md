# Nakama Binder

A collection tracker and deck checker for the **One Piece Card Game** — on the web, iOS and Android
from one codebase.

> **Status: Phase 1 of 5 complete** — accounts, the full EN + JP card database, card search and set
> browsing. Collection tracking (phase 2) and decklist checking (phase 3) are next. See the
> [roadmap](docs/ARCHITECTURE.md#roadmap).

## What works today

- **Card database**: every English and Japanese card printing (~9,900 printings of ~2,900 cards,
  including parallels / alt arts and reprints), refreshed automatically every day from the official
  card list.
- **Search**: by name (English or Japanese), card number (`OP01-016`, `op1-16`) or type
  (`straw hat`), with filters for language, color, card type, cost and rarity.
- **Sets**: browse every booster, extra booster, premium booster, starter deck and promo, per language,
  with or without alternate arts.
- **Card pages**: stats, effect text (English / Japanese) and every printing of the card.
- **Accounts**: sign up / sign in / password reset (email + password), with a profile per user.

## Tech at a glance

| Part | Choice |
|---|---|
| App (web + iOS + Android) | [Expo](https://expo.dev) SDK 58, Expo Router, React Native, TypeScript |
| Backend | [Supabase](https://supabase.com): Postgres, Auth, Row Level Security |
| Card data | Official card list via the [punk-records](https://github.com/buhbbl/punk-records) dataset, imported by `packages/ingest` |
| Hosting | Vercel (web), EAS (app stores) |

## Repository layout

```
apps/app/            Expo app (all platforms). Routes in src/app/, UI in src/components/
packages/core/       Shared domain logic (card ids, set helpers, types) + tests
packages/ingest/     Card data importer (punk-records → Postgres) + tests
supabase/migrations/ Database schema, RLS policies, search function
supabase/tests/      pgTAP database tests
scripts/db/          Run the database tests without Docker
docs/                Setup guide and architecture notes
```

## Getting started

Full, step-by-step instructions (Supabase project, card import, Vercel, mobile builds):
**[docs/SETUP.md](docs/SETUP.md)**.

The short version, once the backend exists:

```bash
corepack enable && pnpm install
cp apps/app/.env.example apps/app/.env.local   # then fill in your Supabase URL + key
pnpm web                                       # or: pnpm dev  (Expo Go / simulators)
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test   # all packages
pnpm db:test                               # migrations + pgTAP tests on a throwaway local Postgres
```

## Legal

Unofficial fan project, not affiliated with or endorsed by Bandai. Card names, text and images are
© Eiichiro Oda/Shueisha, Toei Animation, Bandai Namco Entertainment Inc.
