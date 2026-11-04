# Working on this repository

Instructions for anyone (human or AI) changing this codebase. Product context, data model and roadmap:
`docs/ARCHITECTURE.md`. Environment setup: `docs/SETUP.md`.

## Layout

- `apps/app` — Expo SDK 58 app (web/iOS/Android). Also read `apps/app/AGENTS.md` (Expo-specific rules).
- `packages/core` — pure TypeScript domain logic shared by app and importer. Put parsers, deck-check
  logic etc. here, with vitest tests.
- `packages/ingest` — card-data importer.
- `supabase/migrations` — schema. `supabase/tests/database` — pgTAP tests.

## Commands (run from the repo root)

```bash
pnpm typecheck && pnpm lint && pnpm test   # must pass before committing
pnpm db:test                               # migrations + pgTAP on a throwaway Postgres (no Docker)
pnpm build:web                             # production web export
pnpm ingest --fetch --dry-run              # normalize the latest card data without a database
```

## Rules and gotchas

- **Migrations are append-only once deployed.** Add a new timestamped file in `supabase/migrations/`;
  never edit one that may have been applied. Every new table gets RLS + explicit grants + pgTAP tests.
- **Keep `packages/core/src/types.ts` in sync with the SQL** (row shapes, enums).
- **Never style the child of `<Link asChild>` with `style`.** On web, Link merges the child's `style`
  with an object spread, which drops style functions and breaks style arrays. Use `PressableArea`
  (`boxStyle` prop) or `Button` (`boxStyle`) as the Link child. See `components/ui/pressable-area.tsx`.
- **Web tabs (`components/app-tabs.web.tsx`):** `<TabTrigger>`s must be direct children of `<TabList>`
  (or of its single `asChild` child) and `<TabList>` a direct child of `<Tabs>`. Wrapping them in other
  views renders fine but makes clicks silently do nothing. Test navigation by clicking, not `goto`.
- **All user-facing strings go through i18n** (`useTranslation()`, keys in
  `apps/app/src/i18n/locales/en.json`).
- Add Expo-ecosystem dependencies with `npx expo install <pkg>` (from `apps/app`) so versions match the
  SDK. Without network access to api.expo.dev, prefix with `EXPO_OFFLINE=1`.
- pnpm uses `node-linker=hoisted` (required by React Native / Metro). Don't change it.
- Collections reference **printings**; decks reference **cards** (any printing satisfies a deck slot).
- The importer must never delete catalog rows (users may own them).
- Secrets: the app may only contain `EXPO_PUBLIC_SUPABASE_URL` and the publishable/anon key. The
  database URL / service keys belong in GitHub Actions secrets only.
