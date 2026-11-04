import {
  CATEGORIES,
  COLORS,
  LANGUAGES,
  RARITIES,
  formatSetCode,
  parsePrintingCode,
  printingId,
  setKindFor,
  type CardRow,
  type Category,
  type Color,
  type Language,
  type PrintingRow,
  type Rarity,
  type SetRow,
} from '@binder/core';

import type { RawCard, RawPack, RawSource } from './source';

export type NormalizedCard = CardRow;
export type NormalizedPrinting = PrintingRow;
export type NormalizedSet = SetRow;

export interface Normalized {
  sets: NormalizedSet[];
  cards: NormalizedCard[];
  printings: NormalizedPrinting[];
  warnings: string[];
}

const KNOWN_TITLE_PREFIXES = new Set([
  'BOOSTER PACK',
  'EXTRA BOOSTER',
  'PREMIUM BOOSTER',
  'STARTER DECK',
  'STARTER DECK EX',
  'ULTRA DECK',
]);

const SET_LABEL_RE = /^[A-Z]+\d*(-[A-Z]*\d+)+$/; // OP-01, ST-10, OP14-EB04
const SINGLE_PRODUCT_LABEL_RE = /^[A-Z]+-\d+$/; // OP-01, PRB-01

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

/** The official site leaks a few HTML entities into titles/names ("Ace &amp; Newgate"). */
export function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const known = HTML_ENTITIES[entity.toLowerCase()];
    if (known) return known;
    if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return match;
  });
}

function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = decodeEntities(value).trim();
  return trimmed === '' || trimmed === '-' ? null : trimmed;
}

function cleanList(values: string[] | null | undefined): string[] {
  return (values ?? []).map((v) => decodeEntities(v).trim()).filter((v) => v !== '');
}

function isOneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

/** Lower variant rank = better representative of a card (base art, English first). */
function printingRank(p: { language: Language; variant: string; variantIndex: number }): number {
  const languageRank = p.language === 'en' ? 0 : 1;
  const variantRank = p.variant === 'base' ? 0 : p.variant === 'reprint' ? 1 : 2;
  return languageRank * 1000 + variantRank * 100 + p.variantIndex;
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

interface PackSummary {
  language: Language;
  sourceId: string;
  pack: RawPack | undefined;
  dominantPrefix: string | undefined;
  printingCount: number;
}

/**
 * Turns the raw per-language dumps into our three catalog tables:
 *
 * - printings: one per (language, printing code) — every art a player can own
 * - cards:     one per card number, merging all printings; English text wins,
 *              Japanese fills in for cards not released in English yet
 * - sets:      one per (language, product)
 *
 * Bad records are skipped with a warning instead of failing the whole run, so one
 * malformed card on the official site cannot block a data refresh.
 */
export function normalize(source: RawSource): Normalized {
  const warnings: string[] = [];
  const printings = new Map<string, NormalizedPrinting>();
  const cardSources = new Map<string, { raw: RawCard; language: Language; rank: number }[]>();
  const packPrefixes = new Map<string, string[]>(); // set id -> set prefixes of its printings

  for (const language of LANGUAGES) {
    const data = source[language];
    if (!data) continue;

    // Deterministic order: by pack id, then card id, so duplicates resolve the same way every run.
    const rawCards = [...data.cards].sort(
      (a, b) => a.pack_id.localeCompare(b.pack_id) || a.id.localeCompare(b.id),
    );

    for (const raw of rawCards) {
      const parsed = parsePrintingCode(raw.id);
      if (!parsed) {
        warnings.push(`${language}: skipped card with unrecognised id "${raw.id}"`);
        continue;
      }
      if (!isOneOf(RARITIES, raw.rarity)) {
        warnings.push(`${language}: skipped ${raw.id}, unknown rarity "${raw.rarity}"`);
        continue;
      }
      if (!isOneOf(CATEGORIES, raw.category)) {
        warnings.push(`${language}: skipped ${raw.id}, unknown category "${raw.category}"`);
        continue;
      }
      const name = cleanText(raw.name);
      if (!name || !raw.img_full_url) {
        warnings.push(`${language}: skipped ${raw.id}, missing name or image`);
        continue;
      }

      const id = printingId(language, raw.id);
      const setId = `${language}-${raw.pack_id}`;
      if (printings.has(id)) {
        // The same printing is listed under several products (e.g. a promo that is
        // also in a gift collection). Keep the first; it is the same physical card.
        continue;
      }

      printings.set(id, {
        id,
        card_id: parsed.cardId,
        language,
        code: raw.id,
        variant: parsed.variant,
        variant_index: parsed.variantIndex,
        set_id: setId,
        rarity: raw.rarity as Rarity,
        name,
        source_image_url: raw.img_full_url,
        image_url: raw.img_full_url,
      });

      const prefixes = packPrefixes.get(setId) ?? [];
      prefixes.push(parsed.setPrefix);
      packPrefixes.set(setId, prefixes);

      const list = cardSources.get(parsed.cardId) ?? [];
      list.push({ raw, language, rank: printingRank({ language, ...parsed }) });
      cardSources.set(parsed.cardId, list);
    }
  }

  // ---- cards ----------------------------------------------------------------
  const cards: NormalizedCard[] = [];
  for (const [cardId, list] of cardSources) {
    list.sort((a, b) => a.rank - b.rank);
    const canonical = list[0]!.raw;
    const en = list.find((s) => s.language === 'en')?.raw;
    const ja = list.find((s) => s.language === 'ja')?.raw;

    const colors = cleanList(canonical.colors).filter((c): c is Color => {
      const ok = isOneOf(COLORS, c);
      if (!ok) warnings.push(`card ${cardId}: dropped unknown color "${c}"`);
      return ok;
    });

    cards.push({
      id: cardId,
      name: cleanText(en?.name) ?? cleanText(ja?.name) ?? cardId,
      name_en: cleanText(en?.name),
      name_ja: cleanText(ja?.name),
      category: canonical.category as Category,
      colors,
      cost: canonical.cost ?? null,
      power: canonical.power ?? null,
      counter: canonical.counter ?? null,
      attributes: cleanList(canonical.attributes),
      types: cleanList(canonical.types),
      effect: cleanText(en?.effect),
      trigger: cleanText(en?.trigger),
      effect_ja: cleanText(ja?.effect),
      trigger_ja: cleanText(ja?.trigger),
      block_number: canonical.block_number ?? null,
    });
  }
  cards.sort((a, b) => a.id.localeCompare(b.id));

  // ---- sets -----------------------------------------------------------------
  const summaries = new Map<string, PackSummary>();
  for (const p of printings.values()) {
    const summary = summaries.get(p.set_id);
    if (summary) {
      summary.printingCount += 1;
      continue;
    }
    const sourceId = p.set_id.slice(p.language.length + 1);
    summaries.set(p.set_id, {
      language: p.language,
      sourceId,
      pack: source[p.language]?.packs[sourceId],
      dominantPrefix: mostCommon(packPrefixes.get(p.set_id) ?? []),
      printingCount: 1,
    });
  }

  const sets: NormalizedSet[] = [];
  for (const [setId, s] of summaries) {
    // Japanese packs ship without titles. Products share the last digits across
    // regions (550101 <-> 569101), so borrow the English title when the products
    // contain the same set of cards.
    const englishTwin =
      s.language === 'en' ? undefined : summaries.get(`en-569${s.sourceId.slice(3)}`);
    const titled =
      s.pack ?? (englishTwin && englishTwin.dominantPrefix === s.dominantPrefix ? englishTwin.pack : undefined);

    const prefix = cleanText(titled?.title_parts?.prefix);
    const kind = setKindFor(s.sourceId, prefix);
    // English labels are authoritative. A Japanese product only borrows its twin's
    // label when it names a single product ("PRB-01"), not a combined English
    // release ("OP14-EB04" is two separate products in Japan).
    const titledLabel = cleanText(titled?.title_parts?.label);
    const label =
      s.language === 'en' || (titledLabel && SINGLE_PRODUCT_LABEL_RE.test(titledLabel)) ? titledLabel : null;

    let code: string;
    let name: string;
    if (kind === 'promo') {
      code = 'P';
      name = 'Promotion cards';
    } else if (kind === 'other') {
      code = 'OTHER';
      name = 'Other product cards';
    } else {
      code =
        label && SET_LABEL_RE.test(label)
          ? label
          : s.dominantPrefix
            ? formatSetCode(s.dominantPrefix)
            : s.sourceId;
      const title = cleanText(titled?.title_parts?.title);
      name = title && !KNOWN_TITLE_PREFIXES.has(title.toUpperCase()) ? title : code;
    }

    sets.push({
      id: setId,
      language: s.language,
      source_id: s.sourceId,
      code,
      name,
      kind,
      sort_order: Number.parseInt(s.sourceId, 10) || 0,
      printing_count: s.printingCount,
    });
  }
  sets.sort((a, b) => a.id.localeCompare(b.id));

  const printingList = [...printings.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { sets, cards, printings: printingList, warnings };
}
