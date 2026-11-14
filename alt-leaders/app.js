import { CSV_URLS, SHEET_URL } from './config.js';
import {
  cardmarketSearchUrl,
  filterCards,
  officialImageUrl,
  parseSheet,
  setsOf,
  summarize,
} from './lib.js';

const $ = (sel) => document.querySelector(sel);
const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const money = (n) => (n == null ? '—' : euro.format(n));
const percent = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 1 });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STATUS_PARAM = { owned: 'tenho', missing: 'faltam' };
const state = { cards: [], images: new Set(), set: 'all', status: 'all', query: '', sort: 'sheet' };

// ── Data ──────────────────────────────────────────────

async function fetchText(url, ms = 12_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Live sheet first; the copy saved with the site (refreshed on every deploy) if that fails. */
async function loadData() {
  const override = new URLSearchParams(location.search).get('csv');
  for (const url of override ? [override] : CSV_URLS) {
    try {
      return { ...parseSheet(await fetchText(url)), live: true };
    } catch (err) {
      console.warn(`Folha indisponível em ${url}:`, err);
    }
  }
  return { ...parseSheet(await fetchText('data/alt-leaders.csv')), live: false };
}

/** Codes whose image the build copied into img/ (missing locally → empty list). */
async function loadImageIndex() {
  try {
    return new Set(JSON.parse(await fetchText('img/index.json', 5000)));
  } catch {
    return new Set();
  }
}

const imageUrl = (code) => (state.images.has(code) ? `img/${encodeURIComponent(code)}.webp` : officialImageUrl(code));

/** Our copy → official image → a labelled empty frame. */
function setImage(img, code) {
  img.src = imageUrl(code);
  img.onerror = () => {
    const official = officialImageUrl(code);
    if (img.src !== official) {
      img.src = official;
    } else {
      img.onerror = null;
      img.parentElement.classList.add('card__art--empty');
      img.parentElement.dataset.code = code;
    }
  };
}

// ── URL state (so a filtered view can be bookmarked/shared) ─────

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.set = p.get('set') || 'all';
  const estado = p.get('estado');
  state.status = Object.keys(STATUS_PARAM).find((k) => STATUS_PARAM[k] === estado) ?? 'all';
  state.query = p.get('q') ?? '';
  state.sort = p.get('ordem') ?? 'sheet';
}

function writeUrl() {
  const p = new URLSearchParams(location.search);
  const put = (key, value, empty) => (value && value !== empty ? p.set(key, value) : p.delete(key));
  put('set', state.set, 'all');
  put('estado', STATUS_PARAM[state.status], undefined);
  put('q', state.query.trim(), '');
  put('ordem', state.sort, 'sheet');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ── Rendering ─────────────────────────────────────────

function renderStats() {
  const s = summarize(state.cards);
  const stat = (name) => document.querySelector(`[data-stat="${name}"]`);

  stat('owned').textContent = s.owned;
  stat('total').textContent = s.total;
  const bar = stat('bar');
  bar.setAttribute('aria-valuemax', s.total);
  bar.setAttribute('aria-valuenow', s.owned);
  const ratio = s.total ? s.owned / s.total : 0;
  bar.querySelector('.bar__fill').style.width = `${ratio * 100}%`;
  stat('percent').textContent =
    s.owned === s.total && s.total > 0
      ? 'Coleção completa!'
      : `${percent.format(ratio)} · faltam ${s.total - s.owned}`;

  stat('valueEn').textContent = money(s.valueEn);
  stat('valueJp').textContent = money(s.valueJp);
  const split = (owned, missing, unpriced) =>
    `<span>Tenho <strong>${money(owned)}</strong></span><span class="sep"> · </span>` +
    `<span>Faltam ${money(missing)}</span>` +
    (unpriced ? `<span class="sep"> · </span><span>${plural(unpriced, 'carta', 'cartas')} sem preço</span>` : '');
  stat('splitEn').innerHTML = split(s.ownedEn, s.missingEn, s.unpricedEn);
  stat('splitJp').innerHTML = split(s.ownedJp, s.missingJp, s.unpricedJp);

  stat('paid').textContent = money(s.paid);
  stat('paidSub').textContent = s.paidCount
    ? `Em ${plural(s.paidCount, 'carta', 'cartas')}`
    : 'Sem compras registadas';

  $('#stats').setAttribute('aria-busy', 'false');
}

function renderStatusCounts() {
  const owned = state.cards.filter((c) => c.owned).length;
  const counts = { all: state.cards.length, owned, missing: state.cards.length - owned };
  for (const btn of document.querySelectorAll('#status button')) {
    btn.querySelector('.count').textContent = counts[btn.dataset.status];
    btn.setAttribute('aria-pressed', String(btn.dataset.status === state.status));
  }
}

function renderSets() {
  const box = $('#sets');
  box.replaceChildren();
  const all = { set: 'all', total: state.cards.length, owned: state.cards.filter((c) => c.owned).length };
  for (const s of [all, ...setsOf(state.cards)]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    if (s.owned > 0) btn.classList.add('chip--has');
    if (s.owned === s.total && s.set !== 'all') btn.classList.add('chip--complete');
    btn.dataset.set = s.set;
    btn.setAttribute('aria-pressed', String(state.set === s.set));
    const label = document.createElement('span');
    label.textContent = s.set === 'all' ? 'Todos os sets' : s.set;
    const count = document.createElement('span');
    count.className = 'chip__count';
    count.textContent = `${s.owned}/${s.total}`;
    count.setAttribute('aria-label', `tenho ${s.owned} de ${s.total}`);
    btn.append(label, count);
    box.append(btn);
  }
}

function renderGrid() {
  const grid = $('#grid');
  const template = $('#card-template');
  const list = filterCards(state.cards, state);

  const items = list.map((card) => {
    const li = template.content.firstElementChild.cloneNode(true);
    li.classList.toggle('card--owned', card.owned);
    li.dataset.code = card.code;
    const img = li.querySelector('img');
    img.alt = `${card.name} (${card.code})`;
    setImage(img, card.code);
    li.querySelector('.card__name').textContent = card.name;
    li.querySelector('.card__code').textContent = `${card.code} · ${card.set}`;
    li.querySelector('[data-field="en"]').textContent = money(card.priceEn);
    li.querySelector('[data-field="jp"]').textContent = money(card.priceJp);
    if (card.owned) {
      // The badge already says "Tenho"; this line adds what I paid and the note, if any.
      const parts = [card.paid != null ? `Pago ${money(card.paid)}` : '', card.notes].filter(Boolean);
      li.querySelector('.card__paid').textContent = parts.join(' · ');
    }
    li.querySelector('.card__button').setAttribute(
      'aria-label',
      `${card.name}, ${card.code}${card.owned ? ', tenho' : ', falta'}. Ver detalhes`,
    );
    return li;
  });
  grid.replaceChildren(...items);
  grid.setAttribute('aria-busy', 'false');

  $('#empty').hidden = list.length > 0;
  const shown = list.length === state.cards.length ? 'Todas as' : `${list.length} de`;
  const value = list.reduce((t, c) => t + (c.priceEn ?? 0), 0);
  $('#result-line').textContent = list.length
    ? `${shown} ${plural(state.cards.length, 'carta', 'cartas')} · valor EN ${money(value)}`
    : '';
}

function renderSkeleton() {
  const grid = $('#grid');
  const items = Array.from({ length: 12 }, () => {
    const li = document.createElement('li');
    li.className = 'card card--skeleton';
    li.innerHTML = '<span class="card__art"></span><span class="skeleton-line"></span><span class="skeleton-line"></span>';
    return li;
  });
  grid.replaceChildren(...items);
}

function render() {
  renderStatusCounts();
  renderSets();
  renderGrid();
  writeUrl();
}

// ── Detail dialog ─────────────────────────────────────

function openDetail(code) {
  const card = state.cards.find((c) => c.code === code);
  if (!card) return;
  const body = $('#detail-body');
  body.replaceChildren();

  const art = document.createElement('div');
  art.className = 'detail__art card__art';
  const img = document.createElement('img');
  img.alt = `${card.name} (${card.code})`;
  img.width = 480;
  img.height = 670;
  art.append(img);
  setImage(img, card.code);

  const info = document.createElement('div');
  info.className = 'detail__info';
  const h2 = document.createElement('h2');
  h2.id = 'detail-name';
  h2.textContent = card.name;
  const codeLine = document.createElement('p');
  codeLine.className = 'detail__code';
  codeLine.textContent = `${card.code} · ${card.set}`;
  const status = document.createElement('span');
  status.className = `detail__status${card.owned ? ' detail__status--owned' : ''}`;
  status.textContent = card.owned ? '✓ Tenho' : 'Falta';

  const facts = document.createElement('dl');
  facts.className = 'facts';
  const fact = (label, value, gold = false) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (gold) dd.className = 'gold';
    facts.append(dt, dd);
  };
  fact('Cardmarket EN', money(card.priceEn));
  fact('Cardmarket JP', money(card.priceJp));
  if (card.paid != null) fact('Preço de compra', money(card.paid), true);
  if (card.notes) fact('Notas', card.notes);

  const actions = document.createElement('p');
  actions.className = 'detail__actions';
  const link = document.createElement('a');
  link.className = 'button';
  link.href = cardmarketSearchUrl(card.code);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Procurar no Cardmarket ↗';
  actions.append(link);

  info.append(h2, codeLine, status, facts, actions);
  body.append(art, info);
  $('#detail').showModal();
}

// ── Events ────────────────────────────────────────────

function bindEvents() {
  $('#status').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;
    state.status = btn.dataset.status;
    render();
  });
  $('#sets').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-set]');
    if (!btn) return;
    state.set = btn.dataset.set;
    render();
  });
  const query = $('#query');
  query.value = state.query;
  query.addEventListener('input', () => {
    state.query = query.value;
    renderGrid();
    writeUrl();
  });
  const sort = $('#sort');
  sort.value = state.sort;
  if (sort.value !== state.sort) state.sort = sort.value = 'sheet';
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    renderGrid();
    writeUrl();
  });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { set: 'all', status: 'all', query: '', sort: 'sheet' });
    query.value = '';
    sort.value = 'sheet';
    render();
  });
  $('#grid').addEventListener('click', (e) => {
    const li = e.target.closest('.card[data-code]');
    if (li) openDetail(li.dataset.code);
  });
  // Click on the backdrop closes the dialog.
  $('#detail').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });
}

// ── Start ─────────────────────────────────────────────

async function main() {
  $('#sheet-link').href = SHEET_URL;
  readUrl();
  renderSkeleton();
  bindEvents();

  try {
    const [data, images] = await Promise.all([loadData(), loadImageIndex()]);
    state.cards = data.cards;
    state.images = images;
    if (state.set !== 'all' && !state.cards.some((c) => c.set === state.set)) state.set = 'all';

    if (data.priceNote) {
      const note = $('#price-note');
      note.textContent = data.priceNote;
      note.hidden = false;
    }
    if (!data.live) {
      const notice = $('#notice');
      notice.textContent =
        'Não consegui ler a Google Sheet agora; estou a mostrar a última cópia guardada no site.';
      notice.hidden = false;
    }
    renderStats();
    render();
  } catch (err) {
    console.error(err);
    $('#grid').replaceChildren();
    $('#grid').setAttribute('aria-busy', 'false');
    const notice = $('#notice');
    notice.textContent = `Não foi possível carregar a coleção. ${err.message ?? ''}`.trim();
    notice.hidden = false;
  }
}

main();
