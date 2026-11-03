import type { Language, VariantKind } from './types';

/**
 * Card numbers look like `OP01-016`, `ST10-001`, `EB01-007`, `PRB01-001` or `P-001`.
 * Printing codes add an optional variant suffix: `_p<n>` (parallel / alt art)
 * or `_r<n>` (reprint in a later product).
 */
const PRINTING_CODE_RE = /^([A-Z]+(?:\d{2})?)-(\d{3})(?:_([pr])(\d+))?$/;

export interface ParsedPrintingCode {
  /** Game identity shared by every printing, e.g. `OP01-016`. */
  cardId: string;
  /** e.g. `OP01`, `ST10`, `P`. */
  setPrefix: string;
  /** Collector number inside the set, e.g. 16. */
  number: number;
  variant: VariantKind;
  /** 0 for the base printing, otherwise the n of `_p<n>` / `_r<n>`. */
  variantIndex: number;
}

export function parsePrintingCode(code: string): ParsedPrintingCode | null {
  const match = PRINTING_CODE_RE.exec(code);
  if (!match) return null;
  const [, setPrefix = '', num = '', kind, index] = match;
  const variant: VariantKind = kind === 'p' ? 'parallel' : kind === 'r' ? 'reprint' : 'base';
  return {
    cardId: `${setPrefix}-${num}`,
    setPrefix,
    number: Number(num),
    variant,
    variantIndex: index ? Number(index) : 0,
  };
}

/**
 * Normalizes loosely typed card numbers (user input, decklists) to the
 * canonical `OP01-016` form. Returns null when the input is not a card number.
 *
 *   "op01-016" -> "OP01-016"     "OP1-16" -> "OP01-016"
 *   " st10-1 " -> "ST10-001"     "p-1"    -> "P-001"
 *   "OP01-016_p2" -> "OP01-016"  (variant suffixes are dropped)
 */
export function normalizeCardId(input: string): string | null {
  const match = /^\s*([a-z]+)(\d{0,2})\s*-\s*(\d{1,3})(?:_[pr]\d+)?\s*$/i.exec(input);
  if (!match) return null;
  const [, letters = '', digits = '', num = ''] = match;
  const prefix = letters.toUpperCase() + (digits ? digits.padStart(2, '0') : '');
  return `${prefix}-${num.padStart(3, '0')}`;
}

/** Primary key of a printing row: language + printing code, e.g. `en:OP01-016_p3`. */
export function printingId(language: Language, code: string): string {
  return `${language}:${code}`;
}

export function parsePrintingId(id: string): { language: Language; code: string } | null {
  const [language, code] = id.split(':');
  if ((language !== 'en' && language !== 'ja') || !code) return null;
  return { language, code };
}
