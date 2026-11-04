import { normalizeCardId } from './card-id';
import { parseCardList, type ParseIssue } from './card-list';
import type { Category } from './types';

/**
 * Decklists. Decks are card-level ("4x OP01-016"): any art, reprint or language of a
 * card fills the slot, so variant suffixes and languages in pasted lists are ignored.
 */

export interface DeckItem {
  card_id: string;
  quantity: number;
}

export interface ParsedDecklist {
  items: DeckItem[];
  issues: ParseIssue[];
  /** Sum of all quantities (leader included). */
  total: number;
}

export const DECK_SIZE = 50; // plus one leader
export const MAX_COPIES = 4;
export const MAX_DECK_LINE_QUANTITY = 50;

/** Parses an OPTCG Sim / deckbuilder export (or any list the collection importer understands). */
export function parseDecklist(text: string): ParsedDecklist {
  const parsed = parseCardList(text);
  const totals = new Map<string, number>();
  const issues = [...parsed.issues];
  for (const entry of parsed.entries) {
    const cardId = normalizeCardId(entry.code);
    if (!cardId) continue; // parseCardList only returns valid codes
    if (entry.quantity === 0) continue;
    totals.set(cardId, Math.min(MAX_DECK_LINE_QUANTITY, (totals.get(cardId) ?? 0) + entry.quantity));
  }
  const items = [...totals].map(([card_id, quantity]) => ({ card_id, quantity }));
  return { items, issues, total: items.reduce((n, i) => n + i.quantity, 0) };
}

export type DeckProblem =
  | { kind: 'noLeader' }
  | { kind: 'multipleLeaders'; count: number }
  | { kind: 'wrongSize'; count: number }
  | { kind: 'tooManyCopies'; cardId: string; count: number };

/**
 * Tournament-rule sanity checks (shown as warnings, never blocking):
 * exactly 1 Leader, exactly 50 other cards, at most 4 copies of a card number.
 */
export function validateDeck(cards: { card_id: string; category: Category | null; quantity: number }[]): DeckProblem[] {
  const problems: DeckProblem[] = [];
  const leaders = cards.filter((c) => c.category === 'Leader').reduce((n, c) => n + c.quantity, 0);
  if (leaders === 0) problems.push({ kind: 'noLeader' });
  if (leaders > 1) problems.push({ kind: 'multipleLeaders', count: leaders });
  const mainDeck = cards.filter((c) => c.category !== 'Leader').reduce((n, c) => n + c.quantity, 0);
  if (mainDeck !== DECK_SIZE) problems.push({ kind: 'wrongSize', count: mainDeck });
  for (const card of cards) {
    if (card.category !== 'Leader' && card.quantity > MAX_COPIES) {
      problems.push({ kind: 'tooManyCopies', cardId: card.card_id, count: card.quantity });
    }
  }
  return problems;
}

/** "2xOP01-016" lines — pastes straight into OPTCG Sim and most deckbuilders. */
export function toSimList(items: DeckItem[]): string {
  return items.map((i) => `${i.quantity}x${i.card_id}`).join('\n') + (items.length ? '\n' : '');
}

/** Human shopping list: "2x OP01-016 Nami". */
export function toShoppingList(items: (DeckItem & { name?: string | null })[]): string {
  return (
    items.map((i) => `${i.quantity}x ${i.card_id}${i.name ? ` ${i.name}` : ''}`).join('\n') + (items.length ? '\n' : '')
  );
}

/**
 * Card-number prefixes that belong to a product code, used to tell a set's own
 * cards from special inserts (SP / reprints of older cards sold in the same packs).
 *   "OP-17" -> ["OP17"]   "OP14-EB04" -> ["OP14", "EB04"]   "PRB-01" -> ["PRB01"]   "P" -> []
 */
export function setCardPrefixes(setCode: string): string[] {
  const single = /^([A-Z]+)-(\d+)$/.exec(setCode);
  if (single) return [`${single[1]}${single[2]}`];
  return setCode.split('-').filter((part) => /^[A-Z]+\d+$/.test(part));
}

/** True when a card number belongs to the product itself (not a special insert). */
export function isOwnSetCard(cardId: string, setCode: string): boolean {
  const prefixes = setCardPrefixes(setCode);
  if (prefixes.length === 0) return true; // promos / other products: no distinction
  return prefixes.includes(cardId.split('-')[0] ?? '');
}
