// Pure functions shared by the page (app.js), the build script and the tests.
// No DOM, no network: everything here takes text in and returns plain data.

/** Card image on the official card list (the page tries our own copy first). */
export const officialImageUrl = (code) =>
  `https://en.onepiece-cardgame.com/images/cardlist/card/${encodeURIComponent(code)}.png`;

/**
 * RFC 4180 CSV parser (the format Google Sheets publishes): quoted fields may hold
 * commas, newlines and doubled quotes. Returns an array of rows of strings.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Lower-case, no accents, single spaces: "Código" → "codigo". */
export function normalizeLabel(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Euro amount as the sheet formats it ("4 319,97 €", "1.234,50 €", "34.41", "€12")
 * → number, or null when the cell is empty or not a number.
 */
export function parseEuro(value) {
  if (value == null) return null;
  let s = String(value).replace(/[^\d,.-]/g, ''); // drops €, normal/no-break/thin spaces
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the right-most one is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    s = s.split(group).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    // Portuguese decimal comma ("12,50"), unless it is clearly a grouping ("1,234,567").
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.split(',').join('') : s.replace(',', '.');
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s) && s.split('.').length > 2) {
    s = s.split('.').join(''); // "1.234.567" grouping only
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Checkbox / yes-no cell → boolean. Google publishes checkboxes as TRUE/FALSE. */
export function parseOwned(value) {
  const v = normalizeLabel(value);
  return ['true', 'verdadeiro', 'sim', 's', 'yes', 'y', 'x', '1', '✓', '✔', '☑'].includes(v);
}

// Column → header test. Headers may carry explanations, e.g. "Cardmarket EN (média 5 + baratas)".
const COLUMNS = {
  set: (h) => h === 'set' || h === 'coleccao' || h === 'colecao',
  code: (h) => h === 'codigo' || h === 'code' || h === 'cod.',
  name: (h) => h === 'leader' || h === 'lider' || h === 'nome',
  owned: (h) => h === 'tenho',
  priceEn: (h) => /^cardmarket en\b/.test(h),
  priceJp: (h) => /^cardmarket (jp|ja)\b/.test(h),
  paid: (h) => h.startsWith('preco de compra') || h.startsWith('pago'),
  notes: (h) => h === 'notas' || h === 'nota' || h === 'notes',
};

function findHeader(rows) {
  for (let r = 0; r < rows.length; r++) {
    const labels = rows[r].map(normalizeLabel);
    const index = {};
    for (const [key, test] of Object.entries(COLUMNS)) {
      const c = labels.findIndex(test);
      if (c !== -1) index[key] = c;
    }
    if (index.code !== undefined && index.name !== undefined && index.owned !== undefined) {
      return { row: r, index };
    }
  }
  return null;
}

/**
 * Reads the "Alt Leaders" sheet as published to CSV.
 * The header row is found by its labels (it is row 5 today; the summary rows above it
 * are ignored), so moving it or adding columns does not break the page.
 * @returns {{ cards: Card[], priceNote: string | null }}
 */
export function parseSheet(text) {
  const rows = parseCsv(text);
  const header = findHeader(rows);
  if (!header) {
    throw new Error('Não encontrei o cabeçalho (Set, Código, Leader, Tenho…) no CSV.');
  }
  const { index } = header;
  const cell = (row, key) => (index[key] === undefined ? '' : (row[index[key]] ?? '').trim());

  // A note about how prices are collected sits above the header ("Preços Cardmarket: …").
  let priceNote = null;
  for (const row of rows.slice(0, header.row)) {
    const note = row.find((c) => normalizeLabel(c).startsWith('precos cardmarket'));
    if (note) priceNote = note.trim();
  }

  const cards = [];
  for (const row of rows.slice(header.row + 1)) {
    const code = cell(row, 'code');
    if (!code) continue; // blank or trailing rows
    cards.push({
      set: cell(row, 'set') || code.split('-')[0],
      code,
      name: cell(row, 'name') || code,
      owned: parseOwned(cell(row, 'owned')),
      priceEn: parseEuro(cell(row, 'priceEn')),
      priceJp: parseEuro(cell(row, 'priceJp')),
      paid: parseEuro(cell(row, 'paid')),
      notes: cell(row, 'notes'),
    });
  }
  return { cards, priceNote };
}

const sum = (values) => Math.round(values.reduce((t, v) => t + (v ?? 0), 0) * 100) / 100;

/** Totals for the top of the page. Values are the whole list, as on the sheet. */
export function summarize(cards) {
  const owned = cards.filter((c) => c.owned);
  const missing = cards.filter((c) => !c.owned);
  return {
    total: cards.length,
    owned: owned.length,
    valueEn: sum(cards.map((c) => c.priceEn)),
    valueJp: sum(cards.map((c) => c.priceJp)),
    ownedEn: sum(owned.map((c) => c.priceEn)),
    ownedJp: sum(owned.map((c) => c.priceJp)),
    missingEn: sum(missing.map((c) => c.priceEn)),
    missingJp: sum(missing.map((c) => c.priceJp)),
    paid: sum(cards.map((c) => c.paid)),
    paidCount: cards.filter((c) => c.paid != null).length,
    unpricedEn: cards.filter((c) => c.priceEn == null).length,
    unpricedJp: cards.filter((c) => c.priceJp == null).length,
  };
}

/** Sets in sheet order, with how many of each you own. */
export function setsOf(cards) {
  const sets = new Map();
  for (const c of cards) {
    const s = sets.get(c.set) ?? { set: c.set, total: 0, owned: 0 };
    s.total++;
    if (c.owned) s.owned++;
    sets.set(c.set, s);
  }
  return [...sets.values()];
}

/**
 * Applies the page's filters and sort order.
 * @param {{ set?: string, status?: 'all'|'owned'|'missing', query?: string, sort?: string }} f
 */
export function filterCards(cards, f = {}) {
  const query = normalizeLabel(f.query ?? '');
  const list = cards
    .map((card, order) => ({ card, order }))
    .filter(({ card }) => {
      if (f.set && f.set !== 'all' && card.set !== f.set) return false;
      if (f.status === 'owned' && !card.owned) return false;
      if (f.status === 'missing' && card.owned) return false;
      if (query && !normalizeLabel(`${card.name} ${card.code} ${card.set}`).includes(query)) return false;
      return true;
    });

  const byPrice = (key) => (a, b) => (b.card[key] ?? -1) - (a.card[key] ?? -1) || a.order - b.order;
  const sorters = {
    sheet: (a, b) => a.order - b.order,
    'price-en': byPrice('priceEn'),
    'price-jp': byPrice('priceJp'),
    name: (a, b) => a.card.name.localeCompare(b.card.name, 'pt') || a.order - b.order,
  };
  return list.sort(sorters[f.sort] ?? sorters.sheet).map(({ card }) => card);
}

/** Search on Cardmarket (we have no product links, only the card code). */
export const cardmarketSearchUrl = (code) =>
  `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(code.replace(/_p\d+$/, ''))}`;
