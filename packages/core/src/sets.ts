import { SET_KINDS, type Rarity, type SetKind, type VariantKind } from './types';

const KIND_BY_TITLE_PREFIX: Record<string, SetKind> = {
  'BOOSTER PACK': 'booster',
  'EXTRA BOOSTER': 'extra',
  'PREMIUM BOOSTER': 'premium',
  'STARTER DECK': 'starter',
  'STARTER DECK EX': 'starter',
  'ULTRA DECK': 'starter',
};

/**
 * The official card list numbers products like `569101`: the 4th digit encodes
 * the product family (0 starter, 1 booster, 2 extra, 3 premium, 9 promo).
 * The title prefix is used first because it is explicit; the digit is the fallback
 * (the Japanese dataset ships without product titles).
 */
export function setKindFor(sourceId: string, titlePrefix?: string | null): SetKind {
  const byTitle = titlePrefix ? KIND_BY_TITLE_PREFIX[titlePrefix.trim().toUpperCase()] : undefined;
  if (byTitle) return byTitle;
  switch (sourceId.charAt(3)) {
    case '0':
      return 'starter';
    case '1':
      return 'booster';
    case '2':
      return 'extra';
    case '3':
      return 'premium';
    case '9':
      return 'promo';
    default:
      return 'other';
  }
}

/** `OP01` -> `OP-01`, `PRB02` -> `PRB-02`, `P` -> `P`. */
export function formatSetCode(setPrefix: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(setPrefix);
  return match ? `${match[1]}-${match[2]}` : setPrefix;
}

/** Sort comparator: kind groups in SET_KINDS order, newest product first inside a group. */
export function compareSets(
  a: { kind: SetKind; sort_order: number },
  b: { kind: SetKind; sort_order: number },
): number {
  const byKind = SET_KINDS.indexOf(a.kind) - SET_KINDS.indexOf(b.kind);
  return byKind !== 0 ? byKind : b.sort_order - a.sort_order;
}

const RARITY_SHORT: Record<Rarity, string> = {
  Leader: 'L',
  Common: 'C',
  Uncommon: 'UC',
  Rare: 'R',
  SuperRare: 'SR',
  SecretRare: 'SEC',
  Special: 'SP',
  TreasureRare: 'TR',
  Promo: 'P',
};

export function rarityShort(rarity: Rarity): string {
  return RARITY_SHORT[rarity] ?? rarity;
}

/** Short human label for a printing variant, e.g. "Parallel 2", "Reprint". */
export function variantLabel(variant: VariantKind, index: number): string {
  if (variant === 'base') return 'Base';
  const name = variant === 'parallel' ? 'Parallel' : 'Reprint';
  return index > 1 ? `${name} ${index}` : name;
}
