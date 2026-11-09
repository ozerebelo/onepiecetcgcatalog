import { describe, expect, it } from 'vitest';

import { diffImport } from './import-diff';

const owned = new Map([
  ['en:OP01-001', 2],
  ['en:OP01-016', 1],
  ['ja:OP01-001', 3],
]);

describe('diffImport', () => {
  it('add: adds to what is owned and counts copies, not printings', () => {
    const d = diffImport(owned, [{ printing_id: 'en:OP01-016', quantity: 4 }, { printing_id: 'en:OP01-025_p1', quantity: 2 }], 'add');
    expect(d.changes).toEqual([
      { printing_id: 'en:OP01-016', before: 1, after: 5 },
      { printing_id: 'en:OP01-025_p1', before: 0, after: 2 },
    ]);
    expect([d.copiesAdded, d.copiesRemoved, d.copiesBefore, d.copiesAfter]).toEqual([6, 0, 6, 12]);
  });

  it('set: sets listed printings only; 0 removes; unchanged rows are left out', () => {
    const d = diffImport(owned, [{ printing_id: 'en:OP01-001', quantity: 2 }, { printing_id: 'en:OP01-016', quantity: 0 }], 'set');
    expect(d.changes).toEqual([{ printing_id: 'en:OP01-016', before: 1, after: 0 }]);
    expect(d.copiesRemoved).toBe(1);
  });

  it('replace_all: removes everything not listed, removals first', () => {
    const d = diffImport(owned, [{ printing_id: 'en:OP01-001', quantity: 4 }], 'replace_all');
    expect(d.changes).toEqual([
      { printing_id: 'en:OP01-016', before: 1, after: 0 },
      { printing_id: 'ja:OP01-001', before: 3, after: 0 },
      { printing_id: 'en:OP01-001', before: 2, after: 4 },
    ]);
    expect([d.copiesAdded, d.copiesRemoved, d.copiesAfter]).toEqual([2, 4, 4]);
  });

  it('skips printings the catalog does not know', () => {
    const d = diffImport(owned, [{ printing_id: 'en:OP99-999', quantity: 3 }], 'add', new Set(['en:OP99-999']));
    expect(d.changes).toEqual([]);
    expect(d.copiesAfter).toBe(6);
  });
});
