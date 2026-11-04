import { parsePrintingCode, type VariantKind } from '@binder/core';
import type { TFunction } from 'i18next';

/**
 * "THE WORLD’S STRONGEST WARRIORS" → "The World’s Strongest Warriors". Official set names are (almost)
 * all caps ("ONE PIECE HEROINES EDITION vol.2"); names styled on purpose ("RED Shanks") stay as they are.
 */
export function titleCase(name: string): string {
  const upper = (name.match(/[A-Z]/g) ?? []).length;
  const lower = (name.match(/[a-z]/g) ?? []).length;
  if (upper === 0 || upper / (upper + lower) < 0.8) return name;
  return name.toLowerCase().replace(/(^|[\s\-–(“"'/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Some products are officially named by their code ("OP15-EB04"); show the kind of product instead. */
export function setDisplayName(set: { name: string; code: string }, kindLabel: string): string {
  const bare = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return bare(set.name) === bare(set.code) ? kindLabel : titleCase(set.name);
}

/** "Base", "Alt art", "Alt art 2", "Reprint" … for a printing's variant. */
export function variantName(variant: VariantKind, index: number, t: TFunction): string {
  if (variant === 'base') return t('card.variants.base');
  if (index <= 1) return t(`card.variants.${variant}`);
  return t(`card.variants.${variant}N`, { n: index });
}

/**
 * A printing code for people: "OP16-001_p2" → "OP16-001 · Alt art 2", "OP01-016_r1" → "OP01-016 · Reprint".
 * Base printings are just the card number.
 */
export function printingLabel(code: string, t: TFunction): string {
  const parsed = parsePrintingCode(code);
  if (!parsed) return code;
  if (parsed.variant === 'base') return parsed.cardId;
  return `${parsed.cardId} · ${variantName(parsed.variant, parsed.variantIndex, t)}`;
}

/** A release date ("2026-08-28", or a timestamp starting with it) for display, without time-zone shifts. */
export function formatReleaseDate(value: string | null, locale: string, month: 'short' | 'long'): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString(locale, { year: 'numeric', month, day: 'numeric', timeZone: 'UTC' });
}
