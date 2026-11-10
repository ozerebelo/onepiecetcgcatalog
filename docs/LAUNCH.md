# Launching, marketing and monetizing Yonko

A plan, not a forecast. It contains no market-size or revenue numbers because we have none: there are
no users yet, so every figure here would be invented. Each phase ends with something we can measure,
and the next phase starts only when that measurement says so. Feature work referenced here is in
`docs/ROADMAP.md`.

## Where we stand

- **Product:** live at the web address, free, complete for its core job (track a collection per printing,
  check any decklist, see the meta by leader). Not yet in app stores.
- **Audience:** players who also collect. They already use a deck tool, a simulator and a price site;
  nobody ties "what I own" to "what I can play" in one place. That link is our pitch.
- **Not ready yet:** no privacy policy or terms, no account deletion, no analytics, no way to hear from
  users, nothing shareable, and search engines see one page. Marketing before these are fixed wastes
  the attention it buys.

## Positioning

> **Yonko tells you which decks you can build from the cards you own, and exactly what you're missing.**

Supporting points, in the order a player cares: (1) paste any decklist and see own / missing in
seconds; (2) the meta by leader, with how close your collection is to each; (3) tick off sets and log
boxes fast, English and Japanese kept apart; (4) free.

What we are not: a simulator, a marketplace, or a deck-tech blog. We link out to those.

## Phase 0 — Foundations (before telling anyone)

Roadmap milestone 6. Roughly two to three weeks of building.

| Item | Why it can't wait |
|---|---|
| Privacy policy, terms, account deletion | Required to collect emails lawfully (GDPR) and by both app stores. |
| Cookie-free analytics + error reporting | Without them a launch teaches us nothing. |
| Feedback link + a Discord server | Early users are the roadmap; give them one place to talk. |
| First-run guide | A new account currently lands on an empty page. |
| Public pages rendered for search and sharing | Every card, set and leader page becomes an entry point and a link preview. |
| Custom email sender on the domain | Supabase's built-in sender is rate-limited and looks like spam. |
| Domain, redirects and site address set | Sign-up emails currently point at the old setup. |

**Measure before moving on:** a stranger can sign up, add 20 cards and check a deck without help, and
we can see each of those steps in analytics.

## Phase 1 — Private beta (2–4 weeks)

Goal: 30–50 real players using it for a few weeks, and a list of what confused them.

- Recruit by hand: your own playgroup and local store, two or three One Piece TCG Discord servers
  (ask the moderators first), a handful of players you already know from events.
- Ask each for one thing: import or tick off their real collection, then check a deck they play.
- Talk to at least ten of them. Watch two use it on a phone at a table.
- Fix what they hit. Ship weekly; post a short changelog in the Discord.

**Measure:**
- *Activation:* share of sign-ups who add 20+ cards and run one deck check in their first session.
- *Return:* share who come back in week two.
- *Words:* how they describe it to a friend (that becomes the marketing copy).

Move on when most beta users activate without help and a healthy share return in week two (a third is
a reasonable starting bar; adjust once we see real numbers). If they
don't, the problem is the product, and marketing won't fix it.

## Phase 2 — Public launch

Time it to a moment players are already paying attention: **a new set release or a ban-list
announcement.** Those are the days people rebuild decks and ask "what do I need?".

**Launch-week posts** (written as a player sharing a tool, with a screenshot or short clip each):
- Reddit r/OnePieceTCG and the One Piece TCG subreddits by region. Read each community's
  self-promotion rules first; most allow one post from the maker if it's useful and not repeated.
- The Discord servers from the beta, plus the big community servers, in their tools or resources channel.
- X/Twitter, where the competitive scene posts lists: a thread showing one meta list checked against a
  real collection.
- Short video (TikTok, YouTube Shorts, Reels): "I pasted the winning Regionals list. Here's what I'm
  missing." Fifteen to thirty seconds, screen recording, no face needed.

**Repeatable content** (this is the engine; the launch post is one day):
- **Weekly meta report**, same day every week: top leaders, what moved, one list worth trying. It's
  generated from data we already have, and every item links to a leader page.
- **New-set day:** the set checklist live on release morning, plus "which meta decks does this set
  change".
- **Ban-list day:** which decks lose what, and which lists are still legal. We already have the data.

**Search:** card pages, set checklists and leader pages are thousands of specific pages people search
for ("OP13-001 decklist", "Luffy OP13 core cards", "OP-17 card list"). Once they render for search
engines (Phase 0), this compounds with no further effort.

**Creators and stores:**
- Offer mid-size One Piece TCG YouTubers and streamers a free tool for their deck videos: a public deck
  link with their list that viewers can check against their own collection. Ask for nothing but the link.
- Local stores: a printable QR card "check tonight's winning list against your collection" for the
  counter on tournament night.

**Sharing built into the product** (roadmap milestone 7): public deck links and share images. Every
shared deck is an advert that shows the product working.

**Measure:** sign-ups per channel, activation rate, week-two and week-four return, decks checked per
active user, share links opened.

## Phase 3 — Reasons to come back (ongoing)

Roadmap milestones 7, 8 and 10. Retention is what makes paid plans possible later.

- Weekly meta refresh and the opt-in weekly email.
- Deck builder, so decks are made here and not just pasted here.
- Match log: daily use between set releases, and over time our own matchup data.
- Notifications for things users asked to hear about: new set, ban list, a wishlist card.

## Phase 4 — Native apps

Roadmap milestone 12. Ship to the App Store and Play Store once the web numbers are healthy; the
codebase already builds for both. Camera scanning is the headline feature for the store listing.
Store presence is also a discovery channel ("One Piece TCG collection" searches).

## Monetization

**Principle:** the core stays free forever: tracking a collection, checking decks, the meta. That is
what makes people recommend it. Money comes from things that cost us money to provide or that only
committed players want.

**Order of introduction** (each only when the previous step's numbers justify it):

1. **Affiliate links on "Buy missing" (first, with prices — milestone 9).**
   Every deck check ends in a list of cards to buy. Linking that list to a marketplace is useful to
   the player and pays a commission on purchases. No paywall, no ads. TCGplayer runs an affiliate
   programme for North America; for Europe, check what Cardmarket and the larger card shops offer.
   *To verify: programme terms, commission rates, and whether deep links to a multi-card basket are
   possible.*

2. **Yonko Pro subscription (second, once people return weekly).**
   Candidates for the paid tier, all additive:
   - price history, alerts and collection value over time
   - cheapest way to finish a deck across printings and languages
   - advanced stats and match-log analysis
   - trade matching ("who nearby has what I need")
   - early access to new features; a supporter badge
   Pricing to test, not promise: a low monthly price with a discounted yearly plan, in the range hobby
   tools charge (a few euros a month). Start with a founders' price for beta users.
   Payments: Stripe on the web; app-store billing inside the native apps (they take a cut and require
   their own payment system for digital features).

3. **Store and organiser tools (later, if stores ask).**
   A page for a store's playgroup, event results posted straight into the meta, stock-list matching
   against local wishlists. Sold per store per month.

4. **Supporter option (any time).** A simple "support the project" tier or one-off tip for people who
   want to help. Low income, high goodwill.

**What not to do:** display ads (they cheapen a tool people open at the table and pay little at this
size), selling user data (never), or locking anything that is free today.

## Costs to plan for

| Item | Notes |
|---|---|
| Hosting and database | Free tiers today; paid plans (tens of euros a month) once traffic or storage grows. |
| Card images storage and bandwidth | Grows with every set and with traffic; the main variable cost. |
| Price data | Paid API once milestone 9 starts (see "Prices: options" in the roadmap). |
| Email sending | A transactional email service for sign-up and weekly emails. |
| App stores | Apple's developer programme is a yearly fee; Google's is a one-off fee. |
| Domain | Yearly. |
| Legal | A one-off review of the privacy policy, terms and the IP question below. |

## Risks

- **Intellectual property.** Card names, text and images belong to Bandai, Shueisha and Toei. Fan
  tools are common and tolerated, but tolerance is not a licence, and charging money raises the
  stakes. The app name is also a One Piece term. Before taking payments or submitting to app stores:
  read Bandai's published guidelines for fan content, keep the "unofficial fan project" notice
  prominent, and get a lawyer's view. *This plan is not legal advice.*
- **Data sources.** Meta lists and prices come from other sites. Permission requests are drafted; a
  source saying no means more hand curation or a different source. Our own match log reduces this
  dependence over time.
- **App-store review.** Stores reject apps that look like they infringe a brand. A clear fan-project
  notice and no official logos help; rejection is still possible.
- **A game that changes.** New rules (formats, blocks, bans) need quick updates. The ban list and
  block window are small files in the repo for that reason.
- **One-person project.** Weekly content and support take time. Automate the weekly report first.

## Decisions for you

| When | Decision |
|---|---|
| Phase 0 | Who legally operates Yonko (you or a company); contact address for the privacy policy. |
| Phase 0 | Which analytics tool (recommend cookie-free). |
| Phase 0 | Discord server: yes/no, and who moderates. |
| Phase 1 | Which communities you can personally introduce the beta to. |
| Phase 2 | Launch date: which set release or ban-list announcement to aim for. |
| Before any payment | Legal review of the IP question; subscription price to test; which marketplaces to partner with. |
