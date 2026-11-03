import type {
  CardRow,
  Category,
  CollectionExportRow,
  Color,
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
