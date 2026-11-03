import { normalizePrintingCode, parseLanguage, printingId } from './card-id';
import { parseCsv } from './csv';
import type { Language } from './types';

/**
 * Parsing of pasted card lists and CSV files, used by collection import (and,
 * at card level, by decklists in phase 3).
 *
 * Accepted list lines (one card per line, case-insensitive, extra words ignored):
 *
 *   4xOP01-016                OPTCG Sim / deckbuilder export
 *   4 x OP01-016  |  4 OP01-016  |  OP01-016 x4  |  OP01-016      (quantity defaults to 1)
 *   2x OP01-016_p1 JP          alt art, Japanese copy
 *   1 en:OP05-119_p2           printing id as exported by this app
 *   3x OP01-016 EN Nami        trailing names are ignored
 *   # comment / // comment     ignored, as are blank lines
 *
 * CSV files need a header row. Recognised columns (any order, case-insensitive):
 *   printing_id  |  code / card / card_id / number / id   (one of these is required)
 *   quantity / qty / count / copies / amount / owned      (default 1)
 *   language / lang                                        (default: chosen in the UI)
 */

export interface ParsedEntry {
  /** 1-based line number in the input, for error messages. */
  line: number;
  /** Printing code including variant suffix, e.g. "OP01-016_p1". */
  code: string;
  /** Null when the line doesn't say; the caller supplies a default. */
  language: Language | null;
  quantity: number;
}

export interface ParseIssue {
  line: number;
  text: string;
  message: 'noCardNumber' | 'badQuantity';
}

export interface ParseResult {
  format: 'list' | 'csv';
  entries: ParsedEntry[];
  issues: ParseIssue[];
}

export const MAX_QUANTITY = 9999;

const HEADER_ALIASES = {
  printingId: ['printing_id', 'printingid', 'printing'],
  code: ['code', 'card', 'card_id', 'cardid', 'card_number', 'cardnumber', 'card_no', 'number', 'id', 'card_code'],
  quantity: ['quantity', 'qty', 'count', 'copies', 'amount', 'owned', 'have', 'total'],
  language: ['language', 'lang', 'locale'],
} as const;

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s.#-]+/g, '_');

function findColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((h) => (aliases as readonly string[]).includes(h));
}

function parseQuantity(raw: string): number | null {
  const match = /^[x×]?\s*(\d+)\s*[x×]?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value <= MAX_QUANTITY ? value : null;
}

/** "en:OP01-016_p1" → { language, code } */
function parsePrintingToken(token: string): { language: Language; code: string } | null {
  const match = /^(en|ja|jp):(.+)$/i.exec(token.trim());
  if (!match) return null;
  const language = parseLanguage(match[1]!);
  const code = normalizePrintingCode(match[2]!);
  return language && code ? { language, code } : null;
}

const COMPACT_RE = /^(\d+)\s*[x×]\s*((?:en|ja|jp):)?([a-z]+\d{0,2}-\d{1,3}(?:_[pr]\d+)?)\b/i;

export function parseListLine(text: string, line: number): ParsedEntry | ParseIssue | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

  let code: string | null = null;
  let language: Language | null = null;
  let quantity: number | null = null;
  let rest = trimmed;

  // Fast path for "4xOP01-016" (no space between quantity and code).
  const compact = COMPACT_RE.exec(trimmed);
  if (compact) {
    quantity = Number(compact[1]);
    language = compact[2] ? parseLanguage(compact[2].slice(0, -1)) : null;
    code = normalizePrintingCode(compact[3]!);
    rest = trimmed.slice(compact[0].length);
  }

  for (const token of rest.split(/[\s,;|\t]+/).filter(Boolean)) {
    if (!code) {
      const printing = parsePrintingToken(token);
      if (printing) {
        code = printing.code;
        language ??= printing.language;
        continue;
      }
      const maybeCode = normalizePrintingCode(token);
      if (maybeCode) {
        code = maybeCode;
        continue;
      }
    }
    if (quantity == null && /^[x×]?\d+[x×]?$/i.test(token)) {
      quantity = parseQuantity(token);
      if (quantity == null) return { line, text, message: 'badQuantity' };
      continue;
    }
    if (language == null) {
      const lang = parseLanguage(token);
      if (lang) language = lang;
    }
  }

  if (!code) return { line, text, message: 'noCardNumber' };
  if (quantity != null && quantity > MAX_QUANTITY) return { line, text, message: 'badQuantity' };
  return { line, code, language, quantity: quantity ?? 1 };
}

function looksLikeCsvHeader(firstLine: string): boolean {
  const cells = firstLine.split(/[,;\t]/).map(normalizeHeader);
  if (cells.length < 2) return false;
  return (
    findColumn(cells, HEADER_ALIASES.printingId) >= 0 || findColumn(cells, HEADER_ALIASES.code) >= 0
  );
}

function parseCsvText(text: string): ParseResult {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  const headers = (header?.cells ?? []).map(normalizeHeader);
  const printingCol = findColumn(headers, HEADER_ALIASES.printingId);
  const codeCol = findColumn(headers, HEADER_ALIASES.code);
  const qtyCol = findColumn(headers, HEADER_ALIASES.quantity);
  const langCol = findColumn(headers, HEADER_ALIASES.language);

  // Only called when the header has a printing_id or code column (see looksLikeCsvHeader).
  const entries: ParsedEntry[] = [];
  const issues: ParseIssue[] = [];
  for (const row of body) {
    const raw = row.cells.join(',');
    const cell = (index: number) => (index >= 0 ? (row.cells[index] ?? '').trim() : '');

    let code: string | null = null;
    let language: Language | null = langCol >= 0 ? parseLanguage(cell(langCol)) : null;
    const printing = printingCol >= 0 ? parsePrintingToken(cell(printingCol)) : null;
    if (printing) {
      code = printing.code;
      language = printing.language;
    } else if (codeCol >= 0) {
      code = normalizePrintingCode(cell(codeCol));
    }
    if (!code) {
      issues.push({ line: row.line, text: raw, message: 'noCardNumber' });
      continue;
    }

    let quantity = 1;
    if (qtyCol >= 0 && cell(qtyCol) !== '') {
      const parsed = parseQuantity(cell(qtyCol));
      if (parsed == null) {
        issues.push({ line: row.line, text: raw, message: 'badQuantity' });
        continue;
      }
      quantity = parsed;
    }
    entries.push({ line: row.line, code, language, quantity });
  }
  return { format: 'csv', entries, issues };
}

/** Parses pasted text or file contents (list or CSV, auto-detected). */
export function parseCardList(text: string): ParseResult {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  if (looksLikeCsvHeader(firstLine)) return parseCsvText(text);

  const entries: ParsedEntry[] = [];
  const issues: ParseIssue[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const result = parseListLine(raw, index + 1);
    if (!result) return;
    if ('message' in result) issues.push(result);
    else entries.push(result);
  });
  return { format: 'list', entries, issues };
}

export interface ImportItem {
  printing_id: string;
  quantity: number;
}

/**
 * Turns parsed entries into the payload for the import_collection RPC:
 * fills in the default language and sums duplicate printings.
 */
export function toImportItems(entries: ParsedEntry[], defaultLanguage: Language): ImportItem[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const id = printingId(entry.language ?? defaultLanguage, entry.code);
    totals.set(id, Math.min(MAX_QUANTITY, (totals.get(id) ?? 0) + entry.quantity));
  }
  return [...totals].map(([printing_id, quantity]) => ({ printing_id, quantity }));
}
