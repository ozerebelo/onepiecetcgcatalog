import { normalizeCardId } from './card-id';
import { DECK_SIZE, MAX_COPIES, parseDecklist, type DeckItem } from './deck';

/**
 * Meta decks: reference tournament lists we curate by hand (see `packages/ingest/meta/README.md`).
 * Each entry credits where the list was published; the list itself is a Sim-format decklist.
 */
export interface MetaDeckEntry {
  /** Stable key, e.g. "2026-11-08-pomona-regional-3rd-luffy". Lowercase letters, digits and dashes. */
  slug: string;
  /** What players call the deck, e.g. "Blue/Purple Luffy". */
  archetype: string;
  /** The leader's card number; the list must contain exactly one copy of it. */
  leader: string;
  /** The format the event was played in, e.g. "OP17". */
  format: string;
  event: string;
  /** ISO date of the event (YYYY-MM-DD). */
  event_date: string;
  /** Final standing (1 = winner), when known. */
  placement?: number | null;
  /** Number of players, when known. */
  players?: number | null;
  player?: string | null;
  region?: string | null;
  /** Who published the list, and the page we link back to. */
  source_name: string;
  source_url: string;
  /** Sim-format decklist ("1xOP13-001\n4xOP13-016…"), leader included. */
  list: string;
}

export interface MetaDeck extends Omit<MetaDeckEntry, 'list' | 'leader'> {
  leader: string;
  items: DeckItem[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT = /^(?:OP|EB|ST|PRB)\d{2}(?:\.\d)?$/;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInt(value: unknown): number | null | 'bad' {
  if (value == null) return null;
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : 'bad';
}

/**
 * Validates the curated meta-deck file. Returns every problem at once (with the deck's slug or index),
 * so a bad edit is caught in review / CI before it reaches the database.
 */
export function parseMetaDecks(input: unknown): { decks: MetaDeck[]; errors: string[] } {
  const errors: string[] = [];
  const decks: MetaDeck[] = [];
  if (!Array.isArray(input)) return { decks, errors: ['The file must contain a JSON array of decks.'] };
  const slugs = new Set<string>();

  input.forEach((raw: Record<string, unknown>, index) => {
    const where = typeof raw?.slug === 'string' ? raw.slug : `deck #${index + 1}`;
    const fail = (message: string) => errors.push(`${where}: ${message}`);
    if (!raw || typeof raw !== 'object') return fail('not an object');

    const slug = text(raw.slug);
    if (!slug || !SLUG.test(slug)) fail('slug must be lowercase letters, digits and dashes');
    else if (slugs.has(slug)) fail('duplicate slug');
    else slugs.add(slug);

    const archetype = text(raw.archetype);
    if (!archetype) fail('archetype is required');
    const event = text(raw.event);
    if (!event) fail('event is required');
    const format = text(raw.format)?.toUpperCase() ?? null;
    if (!format || !FORMAT.test(format)) fail('format must look like "OP17"');
    const eventDate = text(raw.event_date);
    if (!eventDate || !DATE.test(eventDate) || Number.isNaN(Date.parse(eventDate))) fail('event_date must be YYYY-MM-DD');
    const sourceName = text(raw.source_name);
    if (!sourceName) fail('source_name is required');
    const sourceUrl = text(raw.source_url);
    if (!sourceUrl || !/^https:\/\/\S+$/.test(sourceUrl)) fail('source_url must be an https link to where the list was published');
    const placement = positiveInt(raw.placement);
    if (placement === 'bad') fail('placement must be a positive whole number');
    const players = positiveInt(raw.players);
    if (players === 'bad') fail('players must be a positive whole number');

    const leader = typeof raw.leader === 'string' ? normalizeCardId(raw.leader) : null;
    if (!leader) fail('leader must be a card number');

    const list = typeof raw.list === 'string' ? parseDecklist(raw.list) : null;
    if (!list) return fail('list is required');
    for (const issue of list.issues) fail(`list line ${issue.line}: "${issue.text}" is not a card line`);
    const leaderCopies = leader ? (list.items.find((i) => i.card_id === leader)?.quantity ?? 0) : 0;
    if (leader && leaderCopies !== 1) fail(`the list must contain the leader ${leader} exactly once`);
    const mainDeck = list.total - leaderCopies;
    if (mainDeck !== DECK_SIZE) fail(`the list has ${mainDeck} cards besides the leader (expected ${DECK_SIZE})`);
    for (const item of list.items) {
      if (item.card_id !== leader && item.quantity > MAX_COPIES) fail(`${item.card_id} ×${item.quantity} (max ${MAX_COPIES})`);
    }

    if (slug && archetype && event && format && eventDate && sourceName && sourceUrl && leader) {
      decks.push({
        slug,
        archetype,
        leader,
        format,
        event,
        event_date: eventDate,
        placement: placement === 'bad' ? null : placement,
        players: players === 'bad' ? null : players,
        player: text(raw.player),
        region: text(raw.region),
        source_name: sourceName,
        source_url: sourceUrl,
        items: list.items,
      });
    }
  });

  return { decks: errors.length ? [] : decks, errors };
}

export interface DecklistDiff {
  /** Cards (and how many more copies) the other list plays that yours doesn't. */
  add: DeckItem[];
  /** Cards (and how many copies) yours plays beyond the other list. */
  cut: DeckItem[];
  /** Copies both lists share. */
  shared: number;
}

/** How `mine` would change to become `theirs` (card-level; leaders included like any other card). */
export function diffDecklists(mine: readonly DeckItem[], theirs: readonly DeckItem[]): DecklistDiff {
  const a = new Map(mine.map((i) => [i.card_id, i.quantity]));
  const b = new Map(theirs.map((i) => [i.card_id, i.quantity]));
  const add: DeckItem[] = [];
  const cut: DeckItem[] = [];
  let shared = 0;
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const have = a.get(id) ?? 0;
    const want = b.get(id) ?? 0;
    shared += Math.min(have, want);
    if (want > have) add.push({ card_id: id, quantity: want - have });
    if (have > want) cut.push({ card_id: id, quantity: have - want });
  }
  const byCount = (x: DeckItem, y: DeckItem) => y.quantity - x.quantity || x.card_id.localeCompare(y.card_id);
  return { add: add.sort(byCount), cut: cut.sort(byCount), shared };
}
