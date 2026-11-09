# Meta decks

`meta-decks.json` holds the reference tournament lists behind the app's Meta page ("What can you
build", "Best next pickups", and the suggestions on Home and the deck page). It is curated by hand from
public tournament results; every list credits and links to the page where it was published.

## Adding a list

Append an object to the array:

```json
{
  "slug": "2026-11-08-pomona-regional-3rd-luffy",
  "archetype": "Blue/Purple Luffy",
  "leader": "OP13-001",
  "format": "OP17",
  "event": "CoreTCG Pomona Regionals",
  "event_date": "2026-11-08",
  "placement": 3,
  "players": 512,
  "player": "optional",
  "region": "North America",
  "source_name": "OPTCG.GG",
  "source_url": "https://www.optcg.gg/deck-lists/…",
  "list": "1xOP13-001\n4xOP13-016\n…"
}
```

- `list` is a Sim-format export (the "copy decklist" button on most deck sites): the leader once plus
  exactly 50 cards, at most 4 copies of each card number. Any art of a card counts, so use base numbers.
- `slug` is lowercase letters, digits and dashes, unique; keep it stable (it's how updates are matched).
- Only copy the list and its facts (event, date, placement, players). Never copy write-ups, guides or
  images, and always fill `source_name` + `source_url` so the app can credit and link back.
- Remove a list by deleting its object; the next import removes it from the database too.

## Checking and loading

```bash
pnpm ingest --meta-only --dry-run                 # validate the file (CI does this in the ingest tests)
DATABASE_URL=… pnpm ingest --meta-only            # make the database match the file
```

On push to `main`, the *Update database & card data* workflow loads the file after the card import.
Card numbers must already be in the catalog; an unknown number fails the import with the deck's slug.

## Sources

Current at the time of writing (November 2026): [OPTCG.GG](https://www.optcg.gg/deck-lists/top-decks)
(Regionals, Championship Finals, Egman Events, ChinoizeCup…). Limitless and gumgum.gg stopped
covering major events in July/August 2026; BountyLog has player-published lists, not tournament results.
Partnership requests are tracked in `docs/ROADMAP.md`.
