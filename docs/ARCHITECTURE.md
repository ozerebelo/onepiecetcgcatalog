# Architecture

## Goals

1. Players keep an accurate list of the cards they own, down to the exact printing (alt arts,
   parallels, reprints, English vs Japanese).
2. Paste a decklist (OPTCG Sim format) and instantly see what they own and what they're missing.
3. Same experience on web, iOS and Android, synced through an account.

## System overview

```
                    ┌────────────────────────────┐
 official card list │ punk-records (GitHub)      │  daily GitHub Action
 (Bandai) ─────────▶│ static JSON, EN + JP       │──────────────┐
                    └────────────────────────────┘              │ packages/ingest
                                                                ▼ (direct Postgres)
┌──────────────────────────┐   HTTPS (PostgREST + Auth)   ┌──────────────────────────┐
│ Expo app (apps/app)      │ ───────────────────────────▶ │ Supabase                 │
│ web (Vercel) / iOS / And │   publishable key + user JWT │ Postgres + RLS + Auth    │
└──────────────────────────┘                              └──────────────────────────┘
          │ card images (hotlinked)
          ▼
   official card list image CDN
```

### Why these choices

- **One Expo codebase for all three platforms.** Web output is a static single-page app served by
  Vercel. Trade-off: the website feels app-like rather than like a content site, and there's no
  server rendering (fine for a logged-in tool; revisit if public deck pages need SEO).
- **Supabase.** Relational data (cards ↔ printings ↔ collections ↔ decks) fits Postgres, Row Level
  Security lets the app talk to the database directly without a custom API server, and auth is built
  in. Bulk operations (big collection imports, deck checks) can be done in SQL functions next to the
  data.
- **Card data from punk-records**, which scrapes the official card lists for each region. It is
  actively maintained (automated updates) and covers both languages. We consume only its generated
  JSON (its pipeline code is AGPL; the card data itself belongs to Bandai). If it ever stops being
  updated, `packages/ingest/src/source.ts` is the only file that knows about it.
- **Images are hotlinked** from the official card list rather than re-hosted, to avoid redistributing
  Bandai's artwork. The web app sends no `Referer` header. If the official site starts blocking this,
  mirror images into Supabase Storage / a CDN and rewrite `printings.image_url` in the importer.

## Data model

```
sets (one row per product per language)            cards (game identity, one per card number)
  id            "en-569101"                          id          "OP01-016"
  language      en | ja                              name_en / name_ja / name (EN, else JP)
  code          "OP-01"                              category, colors[], cost, power, counter
  name          "ROMANCE DAWN"                       attributes[], types[], effect, trigger,
  kind          booster|extra|premium|starter|       effect_ja, trigger_ja, block_number
                promo|other                          search_text (generated, trigram-indexed)
  printing_count                                              ▲
        ▲                                                     │
        │                printings (what you can own)         │
        └──────────────── id         "en:OP01-016_p2" ────────┘
                          card_id, set_id, language
                          code       "OP01-016_p2"
                          variant    base | parallel | reprint
                          variant_index, rarity, name (as printed), image_url

profiles (1:1 with auth.users)  username, display_name, card_languages[]
ingest_runs                     bookkeeping for "card data updated <date>"

collection_items (phase 2)      PK (user_id, printing_id), quantity 1..9999
                                rows with 0 copies are deleted, so the table holds only owned cards
```

### Collection API (SQL functions, `security invoker` — RLS applies)

| Function | Purpose |
|---|---|
| `adjust_collection_quantity(printing, delta)` | Atomic +/−; safe under rapid taps. Returns the new quantity (0 = removed). |
| `set_collection_quantity(printing, qty)` | Set an exact quantity (0 removes). |
| `import_collection(items jsonb, mode, dry_run)` | Bulk import in one transaction. Modes `add` / `set` / `replace_all`. Duplicates are summed, unknown printings reported. A dry run computes the exact outcome inside a sub-transaction and rolls it back — that's the import preview. |
| `collection_quantities(set?, card?)` | Owned counts for badges and steppers. |
| `collection_summary()`, `collection_set_progress(lang)` | Totals and per-set progress. |
| `search_collection(...)` | The Collection tab: same filters as `search_cards`, printing-level, paginated. |
| `export_collection()` | Whole collection as one JSON array (not subject to the API's 1,000-row page limit). |

Parsing of pasted lists / CSV lives in `packages/core/src/card-list.ts` (shared with phase 3
decklists). The client resolves lines to printing ids (`<lang>:<code>`, with the default language the
user picks) and sends one request; the server validates against the catalog.

In the app, quantity changes are optimistic: the UI updates immediately, the server receives
an atomic delta, and the server's number is applied once the last pending tap for that card returns
(`hooks/use-collection.ts`).

### Identity rules (important for phases 2–3)

- **Collections track printings** (`printings.id`), because an alt art or a Japanese copy is a
  different physical card with a different value.
- **Decklists and deck checks work on cards** (`cards.id`, e.g. `OP01-016`), because any printing —
  any art, any reprint, either language — is legal in a deck. Owned count for a deck slot = sum of
  owned printings of that card (optionally filtered to English only).
- Printing codes come straight from the official list: `OP01-016` (base), `_p<n>` parallel/alt art,
  `_r<n>` reprint in a later product. The database enforces that `id`, `code`, `card_id`, `variant`
  and `variant_index` agree.
- Rows are **never deleted** by the importer, so a printing a user owns can't vanish.

### Product quirks the importer handles

- The Japanese dataset has no product titles; Japanese products borrow the English title when the
  products contain the same cards (`550101` ↔ `569101`).
- English sometimes bundles products that are separate in Japan (EN "OP14-EB04" = JP OP-14 + EB-04);
  codes are only borrowed when they name a single product.
- Premium boosters are mostly reprints, so set codes come from product labels, not card prefixes.
- A few promos are listed under two products; they're stored once.

## Security model

- The app uses the **publishable (anon) key**; it is public by design.
- **RLS is enabled on every table.** Catalog tables are read-only for everyone; only the importer
  (direct Postgres connection, bypasses RLS) writes them. User tables are readable/writable only by
  their owner (`auth.uid() = user_id`). Explicit `grant`/`revoke`s back this up so a missing policy
  never silently opens a table.
- `profiles` rows are created by a `security definer` trigger on sign-up; clients can only edit
  `username`, `display_name`, `card_languages` (column-level grants).
- All database behaviour above is covered by pgTAP tests in `supabase/tests/database/`.

## Search

`public.search_cards(...)` (SQL, `security invoker`) does text matching + filters + ranking +
pagination in one round trip:

- Every query token must appear in the card's number, English name, Japanese name or types
  (punctuation-insensitive: "monkey d luffy" finds "Monkey.D.Luffy"); trigram GIN index.
- Ranking: exact card number → exact name → trigram similarity (shorter/closer names first).
- Representative image follows the user's preferred language, base art first.
- Per-card lookups run only for the returned page; ~10–30 ms for any query on the full dataset.

## App structure (apps/app/src)

```
app/                 Expo Router routes (file = screen)
  (tabs)/            Cards (search), Sets, Account
  card/[id].tsx      Card detail with all printings
  set/[id].tsx       Product grid
  auth/*             Sign in / up, password reset, email-link landing pages
components/          UI kit (ui/) + domain components (card tile, card image, tabs)
lib/                 Supabase client, API calls, auth link handling, validation
providers/auth.tsx   Session state + auth actions
i18n/                i18next setup; every user-facing string lives in locales/en.json
theme/               Colors (light/dark), spacing, card colors
```

## Roadmap

| Phase | Scope | Key additions |
|---|---|---|
| **1 ✅** | Foundation | Accounts, EN+JP catalog + daily import, search, sets, card pages |
| **2 ✅** | Collection | `collection_items` with RLS; +/− on card pages; "tap to collect" set grids with progress and owned/missing filters; bulk paste / CSV / Sim-format import with exact preview (add / set / replace all); CSV + list export; Collection tab with search and filters |
| **3** | Decks (core) | `decks`, `deck_cards (deck_id, card_id, quantity)`; Sim-format parser in `packages/core` (unit-tested); owned / missing per card with any-printing matching; English-only toggle; copy/export missing list; saved decks; optional "cards committed to other built decks" toggle; missing → wishlist |
| **4** | Extras | Wishlist & trade list, card condition / foil tracking, richer filters, prices (needs a licensed price source — TCGplayer / Cardmarket APIs are restricted; evaluate paid aggregators), collection value |
| **5** | Scanning & stores | Camera scanning (card-number OCR on device), Google sign-in / Sign in with Apple, App Store / Play Store release, more UI languages |

## Known limitations

- Search doesn't cover effect text yet (planned with the richer filters).
- Japanese-only cards show Japanese types until the English release fills them in.
- Trigram ranking is weaker for Japanese queries (matching still works).
- Supabase's default email sender is rate-limited; production needs custom SMTP (see SETUP.md).
- Collections track quantity per printing only (no condition, foil, language-of-sleeve notes yet).
- Imports are capped at 50,000 lines per request (far above the ~10,000 printings that exist).
