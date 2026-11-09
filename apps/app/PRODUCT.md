# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **players who also collect** One Piece Card Game cards. They play the game, own a growing
collection, and mostly want to know which decks they can build from what they own and what they still
need to buy or trade. Collecting serves playing: they tick off what they open set by set, then check a
decklist against it.

## Product Purpose

Playset is a checklist for the One Piece Card Game. It records every printing a user owns (base, alt
art, manga, reprints; English and Japanese, each counted separately), shows set completion, and checks
any decklist against the collection to show what is already owned and
exactly what is missing. Success: a player pastes a decklist and knows in seconds what they can build
and what to buy.

## Positioning

The bridge between owning and playing: collections are tracked per printing, while a deck slot is
satisfied by any printing of the card, so alt arts and other languages count toward decks. The name is
the game's own term: a *playset* is the most copies of one card a deck may hold (four), the unit both a
collector and a player care about.

## Operating Context

- Ticking off cards after opening packs, set by set ("tap to collect" on a set page, checklist or grid).
- Pasting decklists from OPTCG Sim or other deckbuilders; copying the missing cards back out as a Sim
  list or a shopping list for a store order.
- Bulk import from pasted lists or CSV with an exact preview (add / set exact / replace all); CSV backup
  export.
- Used on phones (at the table, opening packs) and on desktop (planning decks, bulk imports).

## Capabilities and Constraints

- **English + Japanese cards are first-class everywhere** (confirmed, binding): both languages, every
  printing counted separately.
- Catalog: about 2,900 cards / 9,900 printings, imported automatically from the official card list;
  release dates and set artwork from the official product pages. DON!! cards are not in the data yet.
- Accounts by email + password (Supabase). Collections reference printings; decks reference cards.
- Deck checks: English-only mode, holding back cards in built decks, rule warnings (1 leader, 50 cards,
  max 4 copies).
- One Expo codebase serves web, iOS and Android; the website is the shipped product today, native store
  builds are not released.
- Undecided: monetisation (none today), app store release, interface languages beyond English.

## Brand Commitments

- Name: **Playset** (renamed from "Nakama Binder" because another product uses that name; future work
  must stay clearly distinct from it).
- The app currently states it is an unofficial fan project, not affiliated with Bandai; card data and
  images are © Eiichiro Oda/Shueisha, Toei Animation, Bandai.

## Evidence on Hand

- Real catalog data and official card / set artwork (served from the project's own storage).
- No testimonials, user counts, press, reviews or partnerships exist; do not fabricate any.

## Product Principles

1. Playing first: every collection feature should shorten the path to "can I build this deck?".
2. Exact, not approximate: printings, languages and counts are precise; previews show exactly what will
   change before anything is written.
3. Both languages, always: never treat Japanese cards as second-class.
4. Fast at the table: the common actions (tick a card, check a deck, copy what's missing) take one tap.
