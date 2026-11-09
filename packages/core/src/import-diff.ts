import type { ImportItem } from './card-list';

export type ImportDiffMode = 'add' | 'set' | 'replace_all';

/** One printing whose owned quantity an import would change. */
export interface ImportChange {
  printing_id: string;
  before: number;
  after: number;
}

export interface ImportDiff {
  changes: ImportChange[];
  copiesAdded: number;
  copiesRemoved: number;
  copiesBefore: number;
  copiesAfter: number;
}

const MAX_QUANTITY = 9999;

/**
 * Exactly what an import would do to a collection, printing by printing, so the preview can list it
 * before anything is written. Mirrors the import_collection RPC: `add` adds to what is owned, `set`
 * sets each listed printing (0 removes it), `replace_all` makes the collection exactly the list.
 * Printings the catalog doesn't know (`unknown`) are skipped, as the RPC skips them.
 * Changes are ordered: removals first, then decreases, then increases.
 */
export function diffImport(
  current: ReadonlyMap<string, number>,
  items: readonly ImportItem[],
  mode: ImportDiffMode,
  unknown: ReadonlySet<string> = new Set(),
): ImportDiff {
  const next = new Map<string, number>();
  const listed = items.filter((item) => !unknown.has(item.printing_id));
  for (const item of listed) {
    const before = current.get(item.printing_id) ?? 0;
    const target = mode === 'add' ? before + item.quantity : item.quantity;
    next.set(item.printing_id, Math.min(MAX_QUANTITY, Math.max(0, target)));
  }
  if (mode === 'replace_all') {
    for (const id of current.keys()) if (!next.has(id)) next.set(id, 0);
  }

  const changes: ImportChange[] = [];
  for (const [printing_id, after] of next) {
    const before = current.get(printing_id) ?? 0;
    if (before !== after) changes.push({ printing_id, before, after });
  }
  const rank = (c: ImportChange) => (c.after === 0 ? 0 : c.after < c.before ? 1 : 2);
  changes.sort((a, b) => rank(a) - rank(b) || a.printing_id.localeCompare(b.printing_id));

  let copiesAdded = 0;
  let copiesRemoved = 0;
  for (const c of changes) {
    if (c.after > c.before) copiesAdded += c.after - c.before;
    else copiesRemoved += c.before - c.after;
  }
  const copiesBefore = [...current.values()].reduce((sum, q) => sum + q, 0);
  return { changes, copiesAdded, copiesRemoved, copiesBefore, copiesAfter: copiesBefore + copiesAdded - copiesRemoved };
}
