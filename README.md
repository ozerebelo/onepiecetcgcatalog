# Playset

A checklist for the **One Piece Card Game**: tick off every printing you own, then check any decklist
against it — on the web, iOS and Android from one codebase. (A *playset* is the most copies of one
card a deck may hold: four.)

> **Status: Phase 3 of 5 complete** — accounts, the full EN + JP card database, search, set browsing,
> collection tracking and **deck checking**, with a landing page and a redesigned interface. See the
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
- **Collection** (phase 2): track exactly which printings you own (alt arts and languages separately)
  - **+ / −** on every card page, and **"Tap to collect"** on set pages to tick off a whole set fast (as a checklist or a grid of cards)
  - **Set progress** ("87 / 154 owned") on the Sets list and each set, with Owned / Missing filters
  - **Bulk import** of pasted lists (OPTCG Sim `4xOP01-016`, `2 OP01-025_p1 JP`, …) or CSV files, with an
    exact preview before anything is written; modes *Add*, *Set exact* and *Replace all*
  - **Export** as a CSV backup (re-importable) or copy as a plain list
  - **Collection tab** with the same search and filters as the card database
- **Decks** (phase 3): paste a decklist (OPTCG Sim format or most deckbuilders) and see what you own
  - any art, reprint or language of a card fills its slot; optional **English-only** mode
  - saved decks with completion, rule warnings (1 leader, 50 cards, max 4 copies)
  - mark decks as **built** and optionally hold their cards back when checking other decks
  - copy the missing cards as a Sim list or a shopping list
- **Home**: a landing page for visitors and a dashboard (totals, decks, newest set, recent cards) when signed in
- **Sets** show a pack's own cards first and its special inserts (SP / reprints) separately

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
