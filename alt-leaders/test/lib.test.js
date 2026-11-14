import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  filterCards,
  parseCsv,
  parseEuro,
  parseOwned,
  parseSheet,
  setsOf,
  summarize,
} from '../lib.js';

const snapshot = readFileSync(new URL('../data/alt-leaders.csv', import.meta.url), 'utf8');

test('parseCsv handles quotes, doubled quotes, newlines in fields and CRLF', () => {
  const rows = parseCsv('a,"b, c","say ""hi"""\r\n"multi\nline",,x\n');
  assert.deepEqual(rows, [
    ['a', 'b, c', 'say "hi"'],
    ['multi\nline', '', 'x'],
  ]);
});

test('parseCsv drops a byte-order mark and keeps a last line without newline', () => {
  assert.deepEqual(parseCsv('﻿Set,Código\nOP-01,OP01-001_p1'), [
    ['Set', 'Código'],
    ['OP-01', 'OP01-001_p1'],
  ]);
});

test('parseEuro reads the formats Google Sheets produces', () => {
  assert.equal(parseEuro('576,00 €'), 576);
  assert.equal(parseEuro('4 319,97 €'), 4319.97); // normal space
  assert.equal(parseEuro('4 319,97 €'), 4319.97); // no-break space
  assert.equal(parseEuro('4 319,97 €'), 4319.97); // narrow no-break space
  assert.equal(parseEuro('1.234,50 €'), 1234.5);
  assert.equal(parseEuro('€1,234.50'), 1234.5);
  assert.equal(parseEuro('34.41'), 34.41);
  assert.equal(parseEuro('12'), 12);
  assert.equal(parseEuro(''), null);
  assert.equal(parseEuro('—'), null);
  assert.equal(parseEuro(undefined), null);
});

test('parseOwned accepts checkbox and yes/no values', () => {
  for (const v of ['TRUE', 'true', 'VERDADEIRO', 'Sim', 'x', '✓']) assert.equal(parseOwned(v), true, v);
  for (const v of ['FALSE', 'FALSO', 'Não', '', undefined]) assert.equal(parseOwned(v), false, String(v));
});

test('parseSheet finds the header below the summary rows and reads every card', () => {
  const { cards, priceNote } = parseSheet(snapshot);
  assert.equal(cards.length, 67);
  assert.match(priceNote, /^Preços Cardmarket: média das 5 ofertas mais baratas/);
  assert.deepEqual(cards[0], {
    set: 'OP-01',
    code: 'OP01-001_p1',
    name: 'Roronoa Zoro',
    owned: false,
    priceEn: 576,
    priceJp: 143.98,
    paid: null,
    notes: '',
  });
  const buggy = cards.find((c) => c.code === 'OP09-042_p1');
  assert.equal(buggy.owned, true);
  assert.equal(buggy.paid, 34.41);
  assert.equal(buggy.notes, 'Inglês');
});

test('parseSheet copes with moved/reordered columns and blank rows', () => {
  const csv = [
    'Notas,Leader,Código,Tenho,Preço de compra,Cardmarket JP,Cardmarket EN,Set',
    'Japonês,Sabo,OP05-001_p1,TRUE,"10,00 €","7,84 €","12,36 €",OP-05',
    ',,,,,,,',
    ',Enel,OP05-098_p1,FALSE,,,,',
  ].join('\n');
  const { cards, priceNote } = parseSheet(csv);
  assert.equal(priceNote, null);
  assert.deepEqual(
    cards.map((c) => [c.set, c.code, c.name, c.owned, c.priceEn, c.priceJp, c.paid, c.notes]),
    [
      ['OP-05', 'OP05-001_p1', 'Sabo', true, 12.36, 7.84, 10, 'Japonês'],
      ['OP05', 'OP05-098_p1', 'Enel', false, null, null, null, ''],
    ],
  );
});

test('parseSheet explains what is wrong when the header is missing', () => {
  assert.throws(() => parseSheet('<html>Sign in</html>'), /cabeçalho/);
});

test('summarize matches the totals on the sheet', () => {
  const s = summarize(parseSheet(snapshot).cards);
  assert.equal(s.total, 67);
  assert.equal(s.owned, 1);
  assert.equal(s.valueEn, 4319.97);
  assert.equal(s.valueJp, 1386.33);
  assert.equal(s.paid, 34.41);
  assert.equal(s.ownedEn, 33.18);
  assert.equal(s.missingEn, 4286.79);
  assert.equal(s.unpricedEn, 0);
});

test('setsOf keeps sheet order and counts owned cards', () => {
  const sets = setsOf(parseSheet(snapshot).cards);
  assert.equal(sets[0].set, 'OP-01');
  assert.equal(sets.at(-1).set, 'PRB-01');
  assert.deepEqual(
    sets.find((s) => s.set === 'OP-09'),
    { set: 'OP-09', total: 6, owned: 1 },
  );
});

test('filterCards combines set, status, search and sort', () => {
  const { cards } = parseSheet(snapshot);
  assert.equal(filterCards(cards, { set: 'OP-01' }).length, 8);
  assert.deepEqual(
    filterCards(cards, { status: 'owned' }).map((c) => c.name),
    ['Buggy'],
  );
  assert.equal(filterCards(cards, { status: 'missing' }).length, 66);
  assert.equal(filterCards(cards, { query: 'luffy' }).length, 6);
  assert.equal(filterCards(cards, { query: 'LUFFY', set: 'OP-05' }).length, 1);
  assert.equal(filterCards(cards, { query: 'kin emon' }).length, 0);
  assert.equal(filterCards(cards, { query: 'op09-042' })[0].name, 'Buggy');
  assert.equal(filterCards(cards, { sort: 'price-en' })[0].name, 'Monkey.D.Luffy');
  assert.equal(filterCards(cards, { sort: 'price-jp' }).at(-1).name, 'Nefeltari Vivi');
  assert.equal(filterCards(cards, { sort: 'name' })[0].name, 'Belo Betty');
});
