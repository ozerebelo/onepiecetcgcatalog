# Yonko roadmap

What we build next, in what order, and why. Each milestone ships on its own (build → review → deploy),
so the app gets richer every step instead of waiting for a big release. Sizes are rough: **S** ≈ a day,
**M** ≈ a few days, **L** ≈ a week or more.

## How the order was chosen

1. **The collection has to be complete before it can be interesting.** Stats, suggestions and "what
   can I build" are only as good as the data people enter, so fast entry comes early.
2. **History only exists from the day we start recording it.** An activity log (every add/remove)
   ships early so growth charts and "recently added" have months of data when they arrive.
3. **Use the data we already have before buying or borrowing more.** We already store block numbers
   (every card), 517 Trigger effects, 194 card types, keyword-rich effect texts and 379 names shared
   by several cards — none of it is shown yet. That is the cheapest richness there is.
4. **Build shared pieces once.** Keyword labels, legality and deck statistics are needed by card
   pages, decks *and* meta decks, so they come before the features that reuse them.
5. **Features that need an outside source wait for a decision** (meta decklists, prices), and we
   start each with something we control so it never blocks on a partner.

## Milestones

### 1. Every card tells its story — card pages & search (M)
*Visible on every card, for signed-out visitors too; builds pieces later milestones reuse.*
- Effect text with the game's keyword labels (`[On Play]`, `[When Attacking]`, `[Counter]`,
  `[Trigger]`, `[Blocker]`, `[Rush]`, `[DON!! x1]`…), styled like the printed card; tap for a short
  rules note.
- Types become links: `{Land of Wano}` in effects and the Types line open every card of that type.
- "Also named Yamato": the other cards with the same name, with what you own of each.
- "In your decks": which of your decks use the card and whether you have enough copies for all of them.
- Legality badge from the card's block number (rotation), shared with decks later.
- Bigger art with tap-to-zoom.
- Search filters players expect: type, attribute, counter, power range, has Trigger, keywords; and
  search inside effect text (a known limitation today).

### 2. Log a box in minutes — fast entry + activity log (M)
*Feeds every later milestone; starts recording history.*
- Pack-opening mode: pick a set, type card numbers (`121`, `042`, `016`…), Enter to add; running
  tally with undo; works with a numeric keypad on phones.
- Activity log: every add/remove recorded (who, what, when, how many) by the database itself, so
  imports, quick adds and steppers are all covered.

### 3. Your collection at a glance — Home, Stats, wishlist (M)
- Home "Almost there": cards one copy short of a playset, sets close to complete, the deck you're
  closest to building.
- Home activity: what you added this week, with undo.
- Collection Stats: completion per set, by colour, chase rarities owned (SEC/SP/TR), full playsets,
  spares beyond four (trade material), growth over time (from the activity log).
- Wishlist: mark printings you want (e.g. a chase alt art) or add a deck's missing cards in one tap.

### 4. A deckbuilder's page — deck depth (M)
- Deck profile beside the cost curve: colour split, blockers, triggers, counter total, power curve.
- Opening-hand tester: draw 5, mulligan, see the life cards; repeat.
- Visual decklist (card images stacked ×4) next to the list view.
- Legality: blocks in rotation (from milestone 1) and the banned/restricted list (a small file in the
  repo we update when Bandai announces changes).

### 5. Meta decks & suggestions (L) — see "Sourcing meta decks" below
- A Meta page: current top archetypes by leader, each with a reference list, its source and date.
- "What can you build": every meta deck ranked by how much of it you already own (in your card
  language), with "Missing n" — the deck check you already trust, run against every meta list.
- "Best next pickups": the cards that complete the most meta decks for you.
- Suggestions on Home and in the deck editor: decks for the leaders and colours you collect; on your
  own deck page, how your list differs from the meta list for the same leader.

### 6. Prices (L) — needs a decision (see below)
- Nightly price snapshot per printing; collection value; "Missing 15 ≈ €38" on deck checks and meta
  decks; cheapest way to finish a deck; price history and alerts. The natural paid feature later.

### 7. Binder view & delight (M)
- Binder view: your cards in 3×3 pages you flip through, by set or by your own order.
- Small moments: a highlighter "stamp" when a playset or set completes; shareable deck images.

### 8. Community (L)
- Public profile and collection pages (opt-in, private by default), trade list built from spares and
  wishlist, "who has what I need" matching, shareable deck pages.

### 9. Phones & stores (L)
- Camera scanning (read the card number from a photo), Google / Apple sign-in, App Store and Play
  Store release, card condition / graded copies, more interface languages.

## Sourcing meta decks

Decklists are published openly after tournaments, but the collections of them belong to the sites
that gather them, so we use them with permission and credit. Plan, in order:

1. **Curated by us (no dependency).** A `meta_decks` table we fill from public tournament results:
   ~10–20 reference lists per format, each with leader, archetype, event, date and a link to the
   source. Enough to ship milestone 5's features.
2. **Limitless TCG API (automated, to confirm).** Limitless hosts results and decklists for One Piece
   events ([onepiece.limitlesstcg.com](https://onepiece.limitlesstcg.com/)) and publishes a tournament
   API at `play.limitlesstcg.com/api`. A community project reports it needs no key, takes
   `game=OP`, returns each player's leader and decklist in standings, and allows ~50 requests per
   5 minutes — *unverified: read their developer terms and ask them before building on it.* It most
   likely covers events run on their platform (online / grassroots); major events on the One Piece
   site may need separate permission. Would run nightly, like the card import, and aggregate lists by
   leader.
3. **Partnerships.** Ask aggregators for a feed or permission: Limitless (majors),
   [optcg.gg](https://www.optcg.gg/deck-lists/top-decks), [optcg.one](https://www.optcg.one/decklists),
   [opmetagame.com](https://opmetagame.com/), [OnePieceDB](https://onepiecedb.io/tournaments). Credit
   and link back on every list.
4. **Our own data, later.** Anonymous, opt-in "popular on Yonko" lists built from saved decks — grows
   with the user base and needs no partner.

## Prices: options

No official One Piece endpoint from TCGplayer; Cardmarket's API needs an application. Third-party
services cover One Piece with daily or real-time prices and free tiers to try:
[TCG API](https://tcgapi-site.pages.dev/games/one-piece-card-game) (daily, 100 requests/day free),
[TCG Price Lookup](https://tcgfast.pages.dev/games/one-piece) (200/day free),
[Scrydex](https://scrydex.com/docs/onepiece/api-reference). Japanese-card prices are thinner
everywhere. We only need one nightly sync per printing, so a small paid plan is likely enough. No
scraping.

## Decisions needed (and when)

| Before | Decision |
|---|---|
| Milestone 5 | OK to contact Limitless and the aggregators for permission? (I can draft the emails.) |
| Milestone 5 | Who curates the first meta lists — you, me from public results, or both? |
| Milestone 6 | Price provider and monthly budget; which currencies (USD/EUR) and whether JP prices matter. |
| Milestone 8 | Public profiles: on by choice only (recommended), and moderation for public names. |
