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

### 1. Every card tells its story — card pages & search (M) ✅
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

### 2. Log a box in minutes — fast entry + activity log (M) ✅
*Feeds every later milestone; starts recording history.*
- Pack-opening mode: pick a set, type card numbers (`121`, `042`, `016`…), Enter to add; running
  tally with undo; works with a numeric keypad on phones.
- Activity log: every add/remove recorded (who, what, when, how many) by the database itself, so
  imports, quick adds and steppers are all covered.

### 3. Your collection at a glance — Home, Stats, wishlist (M) ✅
- Home "Almost there": cards one copy short of a playset, sets close to complete, the deck you're
  closest to building.
- Home activity: what you added this week, with undo.
- Collection Stats: completion per set, by colour, chase rarities owned (SEC/SP/TR), full playsets,
  spares beyond four (trade material), growth over time (from the activity log).
- Wishlist: mark printings you want (e.g. a chase alt art) or add a deck's missing cards in one tap.

### 4. A deckbuilder's page — deck depth (M) ✅
- Deck profile beside the cost curve: colour split, blockers, triggers, counter total, power curve.
- Opening-hand tester: draw 5, mulligan, see the life cards; repeat.
- Visual decklist (card images stacked ×4) next to the list view.
- Legality: blocks in rotation (from milestone 1) and the banned/restricted list (a small file in the
  repo we update when Bandai announces changes).

### 5. Meta decks & suggestions (L) — see "Sourcing meta decks" below ✅
*The Meta page ranks leaders by share of top lists; each leader has a page with its core, flex and tech
cards, a consensus list, builds and results. 52 lists (OP17 + EB05, after the 12 Oct 2026 ban list): the
top 8 of Pomona, Sydney and X3 Invitational and the top 4 of ChinoizeCups #122–#131, read from OPTCG.GG's
public deck pages with the owner's go-ahead and credited on every list. Cardkaizoku's leader rankings
(simulator win/play rates) need written permission to republish (their terms) — added to the outreach. Refresh by editing
`packages/ingest/meta/meta-decks.json`.*
- A Meta page: current top archetypes by leader, each with a reference list, its source and date.
- "What can you build": every meta deck ranked by how much of it you already own (in your card
  language), with "Missing n" — the deck check you already trust, run against every meta list.
- "Best next pickups": the cards that complete the most meta decks for you.
- Suggestions on Home and in the deck editor: decks for the leaders and colours you collect; on your
  own deck page, how your list differs from the meta list for the same leader.

## What's next (written 10 November 2026, after a full review of the app)

Milestones 1–5 are live. The review below looked at every screen on phone and desktop, signed in and
signed out. The app does its core job well; what it lacks is (a) the basics a public product needs,
(b) reasons to come back between set releases, and (c) anything that earns money. The order follows
that. Launch, marketing and monetization are planned in `docs/LAUNCH.md`.

### What the review found

**Gaps that block a public launch**
- No privacy policy or terms, and no way to delete an account or change a password in the app.
- No analytics and no error reporting: we can't see whether anyone finishes signing up or where it breaks.
- No feedback channel (a link, an email, a Discord).
- The website is one page to search engines (`"output": "single"`): card, set and meta pages have no
  titles, descriptions or share images of their own, so nothing can rank or preview when shared.
- A new account lands on an empty Home with no guidance on what to do first.
- Bandai's block exceptions (reprinted card numbers that stay legal) aren't modelled, so some legal
  tournament lists read "Not Standard legal". DON!! cards are missing from the data.

**Gaps in the product**
- Decks can only be created by pasting a list. There is no way to build one by searching and adding
  cards, which is what most players expect from a deck tool.
- Nothing is shareable: no public deck link, no image of a deck or of collection progress.
- The meta is refreshed by hand and has no history (what was winning last month), no matchups.
- Nothing tells a user when something changes (new set, ban list, a wishlist card arriving).
- No prices anywhere, so "what's missing" never becomes "what will it cost".

### 6. Ready to show people (M) — do before any marketing
- Privacy policy and terms pages (linked from the footer, Account and sign-up); cookie-free analytics
  and error reporting; a feedback link.
- Account: change password, delete account (removes collection, decks and profile).
- First-run guide on an empty Home: choose card language → pick the set you opened most → tick cards
  or paste a list → check a deck. Three steps, skippable.
- Search-engine and sharing basics: static rendering for public pages (cards, sets, meta, leaders) with
  their own titles, descriptions and share images; a sitemap.
- Legality exceptions and DON!! cards in the data.
- Google and Apple sign-in (fewer abandoned sign-ups than email + password).

### 7. Build and share decks (M)
- Deck builder: search, filter and add cards from inside the deck editor, with the cost curve, rule
  warnings and "own / missing" updating as you go. Pasting stays.
- Public deck links (read-only, opt-in per deck) with a share image; "Copy this deck" for visitors.
- Deck versions and notes; duplicate a deck; sideboard-style "maybe" list.

### 8. A meta worth returning to (M)
- Weekly refresh on a fixed day, automated where a source has agreed (see "Sourcing meta decks"),
  by hand otherwise. A dated "what changed this week" note at the top of the Meta page.
- History: each leader's share over time, per format.
- "Build it from what you own": the closest list to your collection for each leader, not just the consensus.
- Email (opt-in): new set released, ban list changed, weekly meta summary.

### 9. Prices and the first revenue (L) — needs the decisions in "Prices: options"
- Nightly price per printing; collection value; "Missing 12 ≈ €38" on every deck and leader page.
- "Buy missing" links to a marketplace through an affiliate programme (see `docs/LAUNCH.md`).
- Price history and alerts are the first paid features.

### 10. Match log (M)
- Log games in two taps (your leader, their leader, went first/second, won/lost; simulator or paper).
- Personal win rates by leader and matchup. With enough users, community matchup data that no
  partner has to give us.

### 11. Trade and community (L)
- Public profile (opt-in), trade list built from spares and wishlist, "who has what I need" matching,
  local-scene groups (a store or a playgroup sharing a page).

### 12. Phones and stores (L)
- Camera scanning (read the card number), App Store and Play Store release, offline entry at the
  table, card condition and graded copies, more interface languages (Portuguese, Spanish, French,
  German, Japanese).

### Later, if wanted
- Binder view (3×3 pages), completion stamps, tournament prep checklist, proxy sheet for testing,
  sealed-product tracker (boxes opened, pulls per box).

## Sourcing meta decks

Decklists are published openly after tournaments, but the collections of them belong to the sites
that gather them, so we use them with permission and credit. Plan, in order:

**Status (Nov 2026):** OPTCG.GG is the most current source (Regionals, Championship Finals, Egman Events,
ChinoizeCup up to early November). Limitless and gumgum.gg stopped covering major events in July/August
2026; BountyLog has player-published lists, not results; Cardkaizoku's lists are premium. Lists go into
`packages/ingest/meta/meta-decks.json` by hand (README alongside); automated reading of another site's
data waits for its permission.

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
3. **Partnerships.** Ask aggregators for a feed or permission: Cardkaizoku (leader rankings), Limitless (majors),
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
| Milestone 5 | ✅ Yes: contact Limitless and the aggregators (emails drafted 2026-11-09; the owner sends them). |
| Milestone 5 | ✅ Claude curates the first meta lists from public tournament results, each credited and linked to its source. |
| Milestone 6 | Who is the legal owner of the service (you personally or a company) for the privacy policy and terms. |
| Milestone 6 | Analytics tool (recommend a cookie-free one so no consent banner is needed). |
| Milestone 9 | Price provider and monthly budget; which currencies (USD/EUR) and whether JP prices matter. |
| Milestone 9 | Which marketplaces to link to (Cardmarket for Europe, TCGplayer for North America). |
| Milestone 11 | Public profiles: on by choice only (recommended), and moderation for public names. |
