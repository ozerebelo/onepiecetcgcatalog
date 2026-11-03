import { toCsv } from './csv';
import type { Language, Rarity, VariantKind } from './types';

/** One row of the export_collection RPC. */
export interface CollectionExportRow {
  printing_id: string;
  card_id: string;
  code: string;
  language: Language;
  variant: VariantKind;
  rarity: Rarity;
  set_code: string;
  set_name: string;
  name: string;
  quantity: number;
}

export const EXPORT_CSV_HEADERS = [
  'printing_id',
  'quantity',
  'code',
  'language',
  'name',
  'set_code',
  'set_name',
  'rarity',
  'variant',
] as const;

/** Full backup as CSV; re-importable (the importer reads printing_id + quantity). */
export function collectionToCsv(rows: CollectionExportRow[]): string {
  return toCsv([
    [...EXPORT_CSV_HEADERS],
    ...rows.map((r) => [r.printing_id, r.quantity, r.code, r.language, r.name, r.set_code, r.set_name, r.rarity, r.variant]),
  ]);
}

/** Human-readable list, one printing per line: "3x OP01-016_p1 JP Nami". Re-importable. */
export function collectionToList(rows: CollectionExportRow[]): string {
  return rows.map((r) => `${r.quantity}x ${r.code} ${r.language === 'ja' ? 'JP' : 'EN'} ${r.name}`).join('\n') + '\n';
}
