import { describe, expect, it } from 'vitest';

import { normalizePrintingCode, parseLanguage } from './card-id';
import { parseCardList, parseListLine, toImportItems } from './card-list';
import { collectionToCsv, collectionToList, type CollectionExportRow } from './collection-export';
import { parseCsv } from './csv';

describe('normalizePrintingCode / parseLanguage', () => {
  it('keeps variant suffixes', () => {
    expect(normalizePrintingCode('op1-16_P2')).toBe('OP01-016_p2');
    expect(normalizePrintingCode('ST10-001_r1')).toBe('ST10-001_r1');
    expect(normalizePrintingCode('OP01-016')).toBe('OP01-016');
    expect(normalizePrintingCode('OP01-016_p')).toBeNull();
    expect(normalizePrintingCode('Nami')).toBeNull();
  });

  it('understands language spellings', () => {
    expect(parseLanguage('JP')).toBe('ja');
    expect(parseLanguage('(en)')).toBe('en');
    expect(parseLanguage('[Japanese]')).toBe('ja');
    expect(parseLanguage('fr')).toBeNull();
  });
});

describe('parseListLine', () => {
  const entry = (text: string) => parseListLine(text, 1);

  it.each([
    ['4xOP01-016', { code: 'OP01-016', quantity: 4, language: null }],
    ['4x OP01-016', { code: 'OP01-016', quantity: 4, language: null }],
    ['4 x OP01-016', { code: 'OP01-016', quantity: 4, language: null }],
    ['4 OP01-016', { code: 'OP01-016', quantity: 4, language: null }],
    ['OP01-016 x4', { code: 'OP01-016', quantity: 4, language: null }],
    ['OP01-016', { code: 'OP01-016', quantity: 1, language: null }],
    ['2x OP01-016_p1 JP', { code: 'OP01-016_p1', quantity: 2, language: 'ja' }],
    ['1 en:OP05-119_p2', { code: 'OP05-119_p2', quantity: 1, language: 'en' }],
    ['3x OP01-016 EN Nami', { code: 'OP01-016', quantity: 3, language: 'en' }],
    ['1xop1-16', { code: 'OP01-016', quantity: 1, language: null }],
    ['OP01-016, 2, ja', { code: 'OP01-016', quantity: 2, language: 'ja' }],
    ['0 OP01-016', { code: 'OP01-016', quantity: 0, language: null }],
  ])('%j', (text, expected) => {
    expect(entry(text)).toMatchObject(expected);
  });

  it('first quantity / language wins, names with numbers are ignored', () => {
    expect(entry('3x OP01-016 EN Gear 5 JP')).toMatchObject({ quantity: 3, language: 'en' });
  });

  it('skips blank lines and comments', () => {
    expect(entry('')).toBeNull();
    expect(entry('   ')).toBeNull();
    expect(entry('# my binder')).toBeNull();
    expect(entry('// leaders')).toBeNull();
  });

  it('reports lines without a card number', () => {
    expect(entry('4x Monkey.D.Luffy')).toMatchObject({ message: 'noCardNumber' });
  });

  it('rejects absurd quantities', () => {
    expect(entry('100000 OP01-016')).toMatchObject({ message: 'badQuantity' });
  });
});

describe('parseCardList', () => {
  it('parses a pasted Sim decklist', () => {
    const result = parseCardList('1xOP01-001\n4xOP01-016\n\n4xST01-012\n');
    expect(result.format).toBe('list');
    expect(result.issues).toEqual([]);
    expect(result.entries.map((e) => [e.code, e.quantity, e.line])).toEqual([
      ['OP01-001', 1, 1],
      ['OP01-016', 4, 2],
      ['ST01-012', 4, 4],
    ]);
  });

  it('collects issues with line numbers and keeps going', () => {
    const result = parseCardList('4xOP01-016\nnonsense\n2xOP01-025');
    expect(result.entries).toHaveLength(2);
    expect(result.issues).toEqual([{ line: 2, text: 'nonsense', message: 'noCardNumber' }]);
  });

  it('parses CSV with flexible headers, quotes and a BOM', () => {
    const csv = '﻿Card Number,Name,Qty,Lang\r\nOP01-016,"Nami, the navigator",3,JP\r\nop1-25_p1,Zoro,,en\r\nbad,x,1,en\r\n';
    const result = parseCardList(csv);
    expect(result.format).toBe('csv');
    expect(result.entries).toEqual([
      { line: 2, code: 'OP01-016', language: 'ja', quantity: 3 },
      { line: 3, code: 'OP01-025_p1', language: 'en', quantity: 1 },
    ]);
    expect(result.issues).toMatchObject([{ line: 4, message: 'noCardNumber' }]);
  });

  it('parses semicolon CSV (European Excel)', () => {
    const result = parseCardList('code;quantity\nOP01-016;2\n');
    expect(result.entries).toEqual([{ line: 2, code: 'OP01-016', language: null, quantity: 2 }]);
  });

  it('round-trips the CSV export', () => {
    const rows: CollectionExportRow[] = [
      { printing_id: 'en:OP01-016_p1', card_id: 'OP01-016', code: 'OP01-016_p1', language: 'en', variant: 'parallel', rarity: 'Rare', set_code: 'OP-01', set_name: 'ROMANCE DAWN', name: 'Nami', quantity: 2 },
      { printing_id: 'ja:OP01-001', card_id: 'OP01-001', code: 'OP01-001', language: 'ja', variant: 'base', rarity: 'Leader', set_code: 'OP-01', set_name: 'ROMANCE DAWN', name: 'ロロノア・ゾロ', quantity: 1 },
    ];
    const fromCsv = parseCardList(collectionToCsv(rows));
    expect(fromCsv.issues).toEqual([]);
    expect(toImportItems(fromCsv.entries, 'en')).toEqual([
      { printing_id: 'en:OP01-016_p1', quantity: 2 },
      { printing_id: 'ja:OP01-001', quantity: 1 },
    ]);
    const fromList = parseCardList(collectionToList(rows));
    expect(toImportItems(fromList.entries, 'en')).toEqual(toImportItems(fromCsv.entries, 'en'));
  });

  it('reports a CSV without a card column', () => {
    expect(parseCardList('name,quantity\nNami,2').issues[0]?.message).toBe('noCardNumber');
  });
});

describe('toImportItems', () => {
  it('applies the default language and sums duplicates', () => {
    const { entries } = parseCardList('2xOP01-016\n1x OP01-016 EN\n1x OP01-016 JP\n3xOP01-016_p1');
    expect(toImportItems(entries, 'en')).toEqual([
      { printing_id: 'en:OP01-016', quantity: 3 },
      { printing_id: 'ja:OP01-016', quantity: 1 },
      { printing_id: 'en:OP01-016_p1', quantity: 3 },
    ]);
  });

  it('handles very large inputs quickly', () => {
    const lines = Array.from({ length: 20000 }, (_, i) => `1x OP${String((i % 17) + 1).padStart(2, '0')}-${String((i % 120) + 1).padStart(3, '0')}`);
    const started = performance.now();
    const result = parseCardList(lines.join('\n'));
    const items = toImportItems(result.entries, 'en');
    expect(result.entries).toHaveLength(20000);
    expect(items.reduce((n, i) => n + i.quantity, 0)).toBe(20000);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('parseCsv', () => {
  it('handles quoted newlines and escaped quotes', () => {
    expect(parseCsv('a,b\n"line1\nline2","say ""hi"""\n').map((r) => r.cells)).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'say "hi"'],
    ]);
  });
});
