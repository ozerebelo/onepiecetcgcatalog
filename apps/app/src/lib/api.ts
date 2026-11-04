import type {
  CardRow,
  Category,
  CollectionExportRow,
  Color,
  DeckItem,
  DeckRow,
  ImportItem,
  Language,
  PrintingRow,
  Rarity,
  SetRow,
} from '@binder/core';

import { getSupabase } from './supabase';

/** Thrown for any failed backend call, with a message safe to show to users. */
export class ApiError extends Error {}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new ApiError(result.error.message);
  if (result.data == null) throw new ApiError('No data returned');
  return result.data;
}

// ---------------------------------------------------------------------------
// Card search
// ---------------------------------------------------------------------------

export type SearchSort = 'relevance' | 'number' | 'name' | 'cost';

export interface CardSearchParams {
  query: string;
  languages: Language[]; // preferred first; drives the representative image
  setId?: string | null;
  colors: Color[];
  categories: Category[];
  rarities: Rarity[];
  costMin?: number | null;
  costMax?: number | null;
  sort: SearchSort;
}

export interface CardSearchResult {
  id: string;
  name: string;
  name_en: string | null;
  name_ja: string | null;
  category: Category;
  colors: Color[];
  cost: number | null;
  power: number | null;
  counter: number | null;
  types: string[];
  image_url: string;
  printing_count: number;
  total_count: number;
}

export const SEARCH_PAGE_SIZE = 60;

export async function searchCards(params: CardSearchParams, page: number): Promise<CardSearchResult[]> {
  const empty = <T,>(list: T[]) => (list.length > 0 ? list : null);
  const result = await getSupabase().rpc('search_cards', {
    p_query: params.query.trim() || null,
    p_languages: empty(params.languages),
    p_set_id: params.setId ?? null,
    p_colors: empty(params.colors),
    p_categories: empty(params.categories),
    p_rarities: empty(params.rarities),
    p_cost_min: params.costMin ?? null,
    p_cost_max: params.costMax ?? null,
    p_sort: params.sort,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: page * SEARCH_PAGE_SIZE,
  });
  const rows = unwrap(result) as CardSearchResult[];
  // bigint columns arrive as numbers or strings depending on size; normalize.
  return rows.map((r) => ({ ...r, printing_count: Number(r.printing_count), total_count: Number(r.total_count) }));
}

// ---------------------------------------------------------------------------
// Card detail
// ---------------------------------------------------------------------------

export type PrintingWithSet = PrintingRow & { set: Pick<SetRow, 'id' | 'code' | 'name' | 'kind'> };
export type CardDetail = CardRow & { printings: PrintingWithSet[] };

const VARIANT_ORDER = { base: 0, reprint: 1, parallel: 2 } as const;

export async function fetchCard(id: string): Promise<CardDetail | null> {
  const result = await getSupabase()
    .from('cards')
    .select('*, printings(*, set:sets(id, code, name, kind))')
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new ApiError(result.error.message);
  const card = result.data as CardDetail | null;
  if (card) {
    card.printings.sort(
      (a, b) =>
        a.language.localeCompare(b.language) ||
        VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant] ||
        a.variant_index - b.variant_index,
    );
  }
  return card;
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export async function fetchSets(language: Language): Promise<SetRow[]> {
  const result = await getSupabase().from('sets').select('*').eq('language', language);
  return unwrap(result) as SetRow[];
}

export async function fetchSet(id: string): Promise<SetRow | null> {
  const result = await getSupabase().from('sets').select('*').eq('id', id).maybeSingle();
  if (result.error) throw new ApiError(result.error.message);
  return result.data as SetRow | null;
}

export type SetPrinting = PrintingRow & {
  card: Pick<CardRow, 'name' | 'category' | 'colors' | 'cost'>;
};

export async function fetchSetPrintings(setId: string): Promise<SetPrinting[]> {
  const result = await getSupabase()
    .from('printings')
    .select('*, card:cards(name, category, colors, cost)')
    .eq('set_id', setId)
    .order('card_id')
    .order('variant')
    .order('variant_index')
    .limit(1000);
  return unwrap(result) as SetPrinting[];
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export async function fetchLastCatalogUpdate(): Promise<string | null> {
  const result = await getSupabase()
    .from('ingest_runs')
    .select('finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new ApiError(result.error.message);
  return (result.data as { finished_at: string } | null)?.finished_at ?? null;
}

// ---------------------------------------------------------------------------
// Collection (signed-in users; RLS scopes everything to the caller)
// ---------------------------------------------------------------------------

/** printing_id -> owned quantity */
export type QuantityMap = Record<string, number>;

export async function adjustCollectionQuantity(printingId: string, delta: number): Promise<number> {
  const result = await getSupabase().rpc('adjust_collection_quantity', { p_printing_id: printingId, p_delta: delta });
  if (result.error) throw new ApiError(result.error.message);
  return Number(result.data ?? 0);
}

export async function setCollectionQuantity(printingId: string, quantity: number): Promise<number> {
  const result = await getSupabase().rpc('set_collection_quantity', { p_printing_id: printingId, p_quantity: quantity });
  if (result.error) throw new ApiError(result.error.message);
  return Number(result.data ?? 0);
}

export async function fetchCollectionQuantities(scope: { setId?: string; cardId?: string }): Promise<QuantityMap> {
  const result = await getSupabase().rpc('collection_quantities', {
    p_set_id: scope.setId ?? null,
    p_card_id: scope.cardId ?? null,
  });
  const rows = unwrap(result) as { printing_id: string; quantity: number }[];
  return Object.fromEntries(rows.map((r) => [r.printing_id, Number(r.quantity)]));
}

export interface CollectionSummary {
  total_quantity: number;
  unique_printings: number;
  unique_cards: number;
}

export async function fetchCollectionSummary(): Promise<CollectionSummary> {
  const result = await getSupabase().rpc('collection_summary');
  const row = (unwrap(result) as CollectionSummary[])[0];
  return {
    total_quantity: Number(row?.total_quantity ?? 0),
    unique_printings: Number(row?.unique_printings ?? 0),
    unique_cards: Number(row?.unique_cards ?? 0),
  };
}

/** set_id -> number of distinct printings owned in that set */
export async function fetchSetProgress(language: Language): Promise<Record<string, number>> {
  const result = await getSupabase().rpc('collection_set_progress', { p_language: language });
  const rows = unwrap(result) as { set_id: string; owned_printings: number }[];
  return Object.fromEntries(rows.map((r) => [r.set_id, Number(r.owned_printings)]));
}

export type CollectionSort = 'number' | 'name' | 'cost' | 'quantity' | 'recent';

export interface CollectionSearchParams extends Omit<CardSearchParams, 'sort'> {
  sort: CollectionSort;
}

export interface CollectionSearchResult {
  printing_id: string;
  card_id: string;
  code: string;
  language: Language;
  variant: PrintingRow['variant'];
  variant_index: number;
  rarity: Rarity;
  image_url: string;
  set_id: string;
  set_code: string;
  name: string;
  category: Category;
  colors: Color[];
  cost: number | null;
  quantity: number;
  total_count: number;
  total_quantity: number;
}

export async function searchCollection(params: CollectionSearchParams, page: number): Promise<CollectionSearchResult[]> {
  const empty = <T,>(list: T[]) => (list.length > 0 ? list : null);
  const result = await getSupabase().rpc('search_collection', {
    p_query: params.query.trim() || null,
    p_languages: empty(params.languages),
    p_set_id: params.setId ?? null,
    p_colors: empty(params.colors),
    p_categories: empty(params.categories),
    p_rarities: empty(params.rarities),
    p_cost_min: params.costMin ?? null,
    p_cost_max: params.costMax ?? null,
    p_sort: params.sort,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: page * SEARCH_PAGE_SIZE,
  });
  const rows = unwrap(result) as CollectionSearchResult[];
  return rows.map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    total_count: Number(r.total_count),
    total_quantity: Number(r.total_quantity),
  }));
}

export type ImportMode = 'add' | 'set' | 'replace_all';

export interface ImportSummary {
  mode: ImportMode;
  dry_run: boolean;
  rows: number;
  matched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  removed: number;
  unknown_count: number;
  unknown: string[];
  total_quantity: number;
  unique_printings: number;
}

export async function importCollection(items: ImportItem[], mode: ImportMode, dryRun: boolean): Promise<ImportSummary> {
  const result = await getSupabase().rpc('import_collection', { p_items: items, p_mode: mode, p_dry_run: dryRun });
  return unwrap(result) as ImportSummary;
}

export async function exportCollection(): Promise<CollectionExportRow[]> {
  const result = await getSupabase().rpc('export_collection');
  return (unwrap(result) as CollectionExportRow[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export interface CatalogStats {
  cards: number;
  printings: number;
  sets: number;
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const supabase = getSupabase();
  const count = async (table: 'cards' | 'printings' | 'sets') => {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new ApiError(error.message);
    return count ?? 0;
  };
  const [cards, printings, sets] = await Promise.all([count('cards'), count('printings'), count('sets')]);
  return { cards, printings, sets };
}

export interface Showcase {
  set: SetRow;
  printings: Pick<PrintingRow, 'id' | 'card_id' | 'code' | 'name' | 'image_url' | 'rarity'>[];
}

/** The newest English booster and some of its most striking printings (alt arts / secret rares). */
export async function fetchShowcase(): Promise<Showcase | null> {
  const supabase = getSupabase();
  const sets = await supabase
    .from('sets')
    .select('*')
    .eq('language', 'en')
    .eq('kind', 'booster')
    .order('sort_order', { ascending: false })
    .limit(1);
  const set = (unwrap(sets) as SetRow[])[0];
  if (!set) return null;
  const printings = await supabase
    .from('printings')
    .select('id, card_id, code, name, image_url, rarity')
    .eq('set_id', set.id)
    .in('rarity', ['SecretRare', 'Leader', 'SuperRare'])
    .neq('variant', 'base')
    .order('card_id')
    .limit(12);
  return { set, printings: unwrap(printings) as Showcase['printings'] };
}

// ---------------------------------------------------------------------------
// Decks (signed-in users; RLS scopes everything to the caller)
// ---------------------------------------------------------------------------

export interface DeckSummary {
  id: string;
  name: string;
  leader_card_id: string | null;
  leader_name: string | null;
  leader_colors: Color[] | null;
  leader_image_url: string | null;
  is_built: boolean;
  card_count: number;
  owned_count: number;
  updated_at: string;
}

export async function fetchDeckSummaries(languages: Language[] | null): Promise<DeckSummary[]> {
  const result = await getSupabase().rpc('deck_summaries', { p_languages: languages });
  return (unwrap(result) as DeckSummary[]).map((d) => ({
    ...d,
    card_count: Number(d.card_count),
    owned_count: Number(d.owned_count),
  }));
}

export async function fetchDeck(id: string): Promise<DeckRow | null> {
  const result = await getSupabase().from('decks').select('*').eq('id', id).maybeSingle();
  if (result.error) throw new ApiError(result.error.message);
  return result.data as DeckRow | null;
}

export async function fetchDeckItems(id: string): Promise<DeckItem[]> {
  const result = await getSupabase().from('deck_cards').select('card_id, quantity').eq('deck_id', id).order('card_id');
  return unwrap(result) as DeckItem[];
}

export interface CheckRow {
  card_id: string;
  known: boolean;
  name: string | null;
  category: Category | null;
  colors: Color[] | null;
  cost: number | null;
  image_url: string | null;
  needed: number;
  owned: number;
  reserved: number;
  have: number;
  missing: number;
  owned_printings: { printing_id: string; code: string; language: Language; quantity: number }[];
}

export interface CheckOptions {
  languages: Language[] | null;
  reserveBuilt: boolean;
}

export async function checkDeck(id: string, options: CheckOptions): Promise<CheckRow[]> {
  const result = await getSupabase().rpc('check_deck', {
    p_deck_id: id,
    p_languages: options.languages,
    p_reserve_built: options.reserveBuilt,
  });
  return unwrap(result) as CheckRow[];
}

export async function checkCards(items: DeckItem[], options: CheckOptions): Promise<CheckRow[]> {
  const result = await getSupabase().rpc('check_cards', {
    p_items: items,
    p_languages: options.languages,
    p_reserve_built: options.reserveBuilt,
  });
  return unwrap(result) as CheckRow[];
}

export async function saveDeck(
  id: string | null,
  name: string,
  items: DeckItem[],
  notes: string | null,
): Promise<{ id: string; card_count: number; skipped: string[] }> {
  const result = await getSupabase().rpc('save_deck', { p_deck_id: id, p_name: name, p_items: items, p_notes: notes });
  return unwrap(result) as { id: string; card_count: number; skipped: string[] };
}

export async function deleteDeck(id: string): Promise<void> {
  const { error } = await getSupabase().from('decks').delete().eq('id', id);
  if (error) throw new ApiError(error.message);
}

export async function setDeckBuilt(id: string, built: boolean): Promise<void> {
  const { error } = await getSupabase().from('decks').update({ is_built: built }).eq('id', id);
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Landing page (public catalog data only)
// ---------------------------------------------------------------------------

export type LandingPrinting = Pick<
  PrintingRow,
  'id' | 'card_id' | 'code' | 'name' | 'image_url' | 'variant' | 'language' | 'set_id' | 'rarity'
> & { colors: Color[]; category: Category | null };

export interface LandingData {
  /** Every English product, newest first. */
  sets: SetRow[];
  newest: SetRow;
  /** Base English printings of the newest booster's own cards. */
  cards: LandingPrinting[];
  /** Every printing (EN + JP) of the newest booster card that has the most of them. */
  showcase: LandingPrinting[];
}

const LANDING_PRINTING_COLUMNS = 'id, card_id, code, name, image_url, variant, language, set_id, rarity';

/** Everything the landing page shows, from plain public catalog queries. */
export async function fetchLanding(): Promise<LandingData | null> {
  const supabase = getSupabase();
  const sets = (unwrap(await supabase.from('sets').select('*').eq('language', 'en')) as SetRow[]).sort(
    (a, b) => b.sort_order - a.sort_order,
  );
  const newest = sets.find((s) => s.kind === 'booster');
  if (!newest) return null;

  const own = unwrap(
    await supabase.from('printings').select(LANDING_PRINTING_COLUMNS).eq('set_id', newest.id).eq('variant', 'base'),
  ) as Omit<LandingPrinting, 'colors' | 'category'>[];
  const ids = [...new Set(own.map((p) => p.card_id))];
  if (!ids.length) return { sets, newest, cards: [], showcase: [] };

  const [cardRows, related] = await Promise.all([
    supabase.from('cards').select('id, colors, category').in('id', ids),
    supabase.from('printings').select(LANDING_PRINTING_COLUMNS).in('card_id', ids),
  ]);
  const meta = new Map((unwrap(cardRows) as Pick<CardRow, 'id' | 'colors' | 'category'>[]).map((c) => [c.id, c]));
  const withMeta = (p: Omit<LandingPrinting, 'colors' | 'category'>): LandingPrinting => ({
    ...p,
    colors: meta.get(p.card_id)?.colors ?? [],
    category: meta.get(p.card_id)?.category ?? null,
  });

  const all = (unwrap(related) as Omit<LandingPrinting, 'colors' | 'category'>[]).map(withMeta);
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.card_id, (counts.get(p.card_id) ?? 0) + 1);
  const star = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const variantOrder = { base: 0, parallel: 1, reprint: 2 } as const;
  const showcase = all
    .filter((p) => p.card_id === star)
    .sort((a, b) => (a.language === b.language ? 0 : a.language === 'en' ? -1 : 1) || variantOrder[a.variant] - variantOrder[b.variant] || a.code.localeCompare(b.code));

  return {
    sets,
    newest,
    cards: own.map(withMeta).sort((a, b) => a.card_id.localeCompare(b.card_id)),
    showcase,
  };
}

/** A few striking printings per set (leaders and secret rares), for the set list's small portraits. */
export async function fetchSetPortraits(setIds: string[]): Promise<Record<string, Pick<PrintingRow, 'id' | 'name' | 'image_url'>[]>> {
  if (!setIds.length) return {};
  const result = await getSupabase()
    .from('printings')
    .select('id, set_id, name, image_url, rarity')
    .in('set_id', setIds)
    .eq('variant', 'base')
    .in('rarity', ['Leader', 'SecretRare', 'SuperRare'])
    .limit(600);
  const rows = unwrap(result) as (Pick<PrintingRow, 'id' | 'set_id' | 'name' | 'image_url' | 'rarity'>)[];
  const rank = { Leader: 0, SecretRare: 1, SuperRare: 2 } as Record<string, number>;
  const out: Record<string, Pick<PrintingRow, 'id' | 'name' | 'image_url'>[]> = {};
  for (const row of rows.sort((a, b) => (rank[a.rarity] ?? 9) - (rank[b.rarity] ?? 9) || a.id.localeCompare(b.id))) {
    const list = (out[row.set_id] ??= []);
    if (list.length < 3) list.push({ id: row.id, name: row.name, image_url: row.image_url });
  }
  return out;
}

/** Name and picture of the English base printing of each card number (for the landing's deck check). */
export async function fetchCardsBrief(cardIds: string[]): Promise<Record<string, { name: string; image_url: string | null }>> {
  if (!cardIds.length) return {};
  const result = await getSupabase()
    .from('printings')
    .select('card_id, name, image_url, language, variant')
    .in('card_id', cardIds)
    .eq('variant', 'base');
  const rows = unwrap(result) as Pick<PrintingRow, 'card_id' | 'name' | 'image_url' | 'language' | 'variant'>[];
  const out: Record<string, { name: string; image_url: string | null }> = {};
  for (const row of rows.sort((a, b) => (a.language === 'en' ? -1 : 1) - (b.language === 'en' ? -1 : 1))) {
    out[row.card_id] ??= { name: row.name, image_url: row.image_url };
  }
  return out;
}

export interface SetCover {
  set_id: string;
  printing_id: string;
  card_id: string;
  name: string;
  image_url: string | null;
}

/** One representative card picture per set (secret rare, else leader …), keyed by set id. */
export async function fetchSetCovers(language: Language): Promise<Record<string, SetCover>> {
  const rows = unwrap(await getSupabase().rpc('set_covers', { p_language: language })) as SetCover[];
  return Object.fromEntries(rows.map((row) => [row.set_id, row]));
}
