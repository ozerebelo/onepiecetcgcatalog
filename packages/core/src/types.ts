/**
 * Domain vocabulary shared by the app, the ingest pipeline and (later) the
 * deck checker. Database rows use snake_case because that is what Supabase /
 * PostgREST returns; keep these types in sync with supabase/migrations.
 */

export const LANGUAGES = ['en', 'ja'] as const;
export type Language = (typeof LANGUAGES)[number];

export const CATEGORIES = ['Leader', 'Character', 'Event', 'Stage', 'Don'] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const;
export type Color = (typeof COLORS)[number];

export const RARITIES = [
  'Leader',
  'Common',
  'Uncommon',
  'Rare',
  'SuperRare',
  'SecretRare',
  'Special',
  'TreasureRare',
  'Promo',
] as const;
export type Rarity = (typeof RARITIES)[number];

/** Display order for set groups in the UI. */
export const SET_KINDS = ['booster', 'extra', 'premium', 'starter', 'promo', 'other'] as const;
export type SetKind = (typeof SET_KINDS)[number];

/**
 * - base:     the regular printing, code `OP01-016`
 * - parallel: alternate art / parallel / manga etc., code `OP01-016_p3`
 * - reprint:  the same card re-released in another product, code `OP02-008_r1`
 */
export const VARIANT_KINDS = ['base', 'parallel', 'reprint'] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

/** A product the cards were released in (booster, starter deck, promo pool...). One row per language. */
export interface SetRow {
  id: string; // e.g. "en-569101"
  language: Language;
  source_id: string; // id used by the official card list, e.g. "569101"
  code: string; // e.g. "OP-01"
  name: string; // e.g. "ROMANCE DAWN"
  kind: SetKind;
  sort_order: number;
  printing_count: number;
  /** From the official product list; null when unknown (promos, other products). */
  release_date: string | null; // ISO date, e.g. "2026-08-28"
  /** The set's key artwork (the illustration on the pack), our Storage copy; null until copied. */
  image_url: string | null;
  /** Official artwork address the importer copies from. */
  source_image_url: string | null;
}

/** The game-rules identity of a card. All printings of OP01-016 share one CardRow. */
export interface CardRow {
  id: string; // e.g. "OP01-016"
  name: string; // English name when known, otherwise Japanese
  name_en: string | null;
  name_ja: string | null;
  category: Category;
  colors: Color[];
  cost: number | null;
  power: number | null;
  counter: number | null;
  attributes: string[];
  types: string[];
  effect: string | null;
  trigger: string | null;
  effect_ja: string | null;
  trigger_ja: string | null;
  block_number: number | null;
}

/** One physical version of a card that a player can own. */
export interface PrintingRow {
  id: string; // e.g. "en:OP01-016_p3"
  card_id: string;
  language: Language;
  code: string; // e.g. "OP01-016_p3"
  variant: VariantKind;
  variant_index: number;
  set_id: string;
  rarity: Rarity;
  name: string; // localized name as printed
  /** What the apps display: our Storage copy once mirrored, otherwise the official image. */
  image_url: string;
  /** Official image address (import source). */
  source_image_url: string;
}

/** How many copies of one printing a user owns (rows with 0 copies don't exist). */
export interface CollectionItemRow {
  user_id: string;
  printing_id: string;
  quantity: number; // 1..9999
  created_at: string;
  updated_at: string;
}

export interface DeckRow {
  id: string;
  user_id: string;
  name: string;
  leader_card_id: string | null;
  notes: string | null;
  is_built: boolean;
  card_count: number;
  created_at: string;
  updated_at: string;
}

/** A curated tournament list (supabase meta_decks; written only by the importer). */
export interface MetaDeckRow {
  id: string;
  slug: string;
  archetype: string;
  leader_card_id: string;
  format: string;
  event: string;
  event_date: string;
  placement: number | null;
  players: number | null;
  player: string | null;
  region: string | null;
  source_name: string;
  source_url: string;
  card_count: number;
  updated_at: string;
}

export interface MetaDeckCardRow {
  meta_deck_id: string;
  card_id: string;
  quantity: number;
}

export interface DeckCardRow {
  deck_id: string;
  card_id: string;
  quantity: number; // 1..50
}
