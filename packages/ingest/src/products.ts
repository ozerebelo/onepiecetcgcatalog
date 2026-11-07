/**
 * Product details from the official "Products" pages: release date and key artwork per set, and the
 * name of the few sets the card data knows only by their code (e.g. "OP15-EB04").
 *
 * The card dataset has no dates or artwork. The official list (one per language) is paginated by category; each
 * entry carries the product code in its title ("BOOSTER PACK -ROMANCE DAWN- [OP-01]", Japanese uses
 * 【OP-01】), a <time datetime="YYYY-MM-DD"> and a link to the product's own page. That page shows the
 * artwork printed on the pack:
 *   - newer pages: a clean key visual, ".../mv.webp" (square, no text);
 *   - older pages: a banner, ".../mv_01.jpg" (990×556) — artwork in a black frame with the pack photo
 *     at the right and "RELEASE DATE …" along the bottom, so only its artwork part is kept;
 *   - a few one-off campaign pages have neither (the apps then show a card from the set).
 * The same artwork appears on both languages' pages, so a clean picture from either is preferred.
 * Artwork is copied into Storage, like card images, because the official site refuses embedding.
 */
import type { Language } from '@binder/core';
import type pg from 'pg';
import sharp from 'sharp';

import { versionFor, type ImageStore } from './mirror';

export const PRODUCT_SITES: Record<Language, string> = {
  en: 'https://en.onepiece-cardgame.com',
  ja: 'https://www.onepiece-cardgame.com',
};
/** Categories that hold the sets we track (premium and extra boosters are listed under boosters). */
export const PRODUCT_CATEGORIES = ['boosters', 'decks'] as const;
const MAX_PAGES = 20;
const USER_AGENT = 'Playset-ingest/1.0 (+https://github.com/ozerebelo/onepiecetcgcatalog)';

/** Stored artwork size: landscape 4:3. Bump ARTWORK_VERSION when the crop changes to re-copy all. */
export const ARTWORK_WIDTH = 800;
export const ARTWORK_HEIGHT = 600;
const ARTWORK_VERSION = 'art2';

export interface ProductEntry {
  code: string; // e.g. "OP-17", "OP15-EB04", "ST-01"
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  pageUrl: string | null; // the product's own page
}

export type ArtworkKind = 'clean' | 'banner' | 'curated';
export interface Artwork {
  url: string;
  kind: ArtworkKind;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The product code at the end of a title: "[OP-17]" or "【OP-17】". Pre-release editions ("[ST-01 PRE]")
 * and titles without a code return null.
 */
export function productCode(title: string): string | null {
  const match = /[[【]\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*[\]】]\s*$/i.exec(title.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

const JA_PRODUCT_TYPES =
  /^(?:ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ(?:EX)?|アルティメットデッキ)\s*/;

/**
 * The product's own name from its title, without the product type and code:
 * "BOOSTER PACK -ADVENTURE ON KAMI’S ISLAND- [OP15-EB04]" → "ADVENTURE ON KAMI’S ISLAND",
 * "ブースターパック 神の島の冒険【OP-15】" → "神の島の冒険". Null when nothing is left.
 */
export function productName(title: string): string | null {
  const bare = title.replace(/\s*[[【][^\]】]*[\]】]\s*$/, '').trim();
  const dashed = /\s[-–—]\s*(.+?)\s*[-–—]\s*$/.exec(bare)?.[1];
  const name = (dashed ?? bare.replace(JA_PRODUCT_TYPES, '')).replace(/\s+/g, ' ').trim();
  return name || null;
}

/** All product entries on one page of the official list. */
export function parseProductList(html: string, site: string): ProductEntry[] {
  const entries: ProductEntry[] = [];
  for (const item of html.matchAll(/<li class="linkListColBox"[^>]*>([\s\S]*?)<\/li>/g)) {
    const body = item[1] ?? '';
    const rawTitle = /class="linkListColTitle"[^>]*>([\s\S]*?)<\/h4>/.exec(body)?.[1];
    if (!rawTitle) continue;
    const title = decode(rawTitle.replace(/<[^>]+>/g, ''));
    const code = productCode(title);
    if (!code) continue;
    const date = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"/.exec(body)?.[1] ?? null;
    const href = /<a[^>]*href="([^"#]+)"/.exec(body)?.[1];
    entries.push({ code, title, releaseDate: date, pageUrl: href ? new URL(decode(href), site).toString() : null });
  }
  return entries;
}

/** The pack artwork on a product page, if it has one (see the module comment). */
export function findArtwork(html: string, pageUrl: string): Artwork | null {
  const sources = [...html.matchAll(/<img[^>]*?\s(?:data-src|src)="([^"]+)"/g)].map((m) => decode(m[1] ?? ''));
  const resolve = (src: string) => new URL(src.split('?')[0] ?? src, pageUrl).toString();
  const clean = sources.find((src) => /\/mv\.(webp|png|jpe?g)$/i.test(src.split('?')[0] ?? ''));
  if (clean) return { url: resolve(clean), kind: 'clean' };
  const banner = sources.find((src) => /\/mv_0?1\.(webp|png|jpe?g)$/i.test(src.split('?')[0] ?? ''));
  if (banner) return { url: resolve(banner), kind: 'banner' };
  return null;
}

/** Banners are recognised by their file name, so the crop needs no extra column. */
export function artworkKind(url: string): ArtworkKind {
  return /\/mv_0?1\.(webp|png|jpe?g)$/i.test(url) ? 'banner' : 'clean';
}

/**
 * Products whose page is a one-off campaign page with no single artwork picture: the header is
 * built from separate layers (characters, backgrounds, lettering). Their tile artwork is put
 * together from those official pictures instead. Stored as `curated:<code>:<recipe hash>` in
 * `sets.source_image_url`, so changing a recipe re-renders it on the next run.
 */
export type ArtworkRecipe =
  /** One picture, cut to a region given in fractions of its size; 'contain' fits the whole region
   *  over its own stretched left edge instead of filling the frame. */
  | { type: 'crop'; url: string; region: { left: number; top: number; width: number; height: number }; fit?: 'cover' | 'contain' }
  /** A cut-out character placed over a background. */
  | { type: 'over'; background: string; foreground: string }
  /** Several portraits side by side, each optionally over its own background; `keepTop` keeps only
   *  that fraction of each portrait's height (the rest is empty). */
  | { type: 'row'; panels: string[]; panelBackground?: string; keepTop?: number };

const EN_BOOSTERS = 'https://en.onepiece-cardgame.com/products/boosters';
export const CURATED_ARTWORK: Record<string, ArtworkRecipe> = {
  // Awakening of the New Era: Gear 5 Luffy over the page's yellow burst.
  'OP-05': { type: 'over', background: `${EN_BOOSTERS}/op05/images/pc/mv_bg.jpg`, foreground: `${EN_BOOSTERS}/op05/images/mv_chara.png` },
  // Emperors in the New World: the four Emperors' portraits from the page header.
  'OP-09': {
    type: 'row',
    panels: ['bu', 'lf', 'sk', 'tc'].map((who) => `${EN_BOOSTERS}/op09/images/mv_${who}.webp`),
  },
  // Carrying On His Will: the three brothers from the page's character section.
  'OP-13': {
    type: 'row',
    panels: ['ace', 'luffy', 'sabo'].map((who) => `${EN_BOOSTERS}/op13/images/the-three-brothers/chara/img_${who}.webp`),
    panelBackground: `${EN_BOOSTERS}/op13/images/the-three-brothers/chara/bg_chara-fire01.webp`,
    keepTop: 0.6,
  },
  // The World's Strongest Warriors: the release banner from the official home page (Elbaf Luffy).
  'OP-17': {
    type: 'crop',
    url: 'https://en.onepiece-cardgame.com/onepiececg/bccard/en/banner/2026/08/06/TwCkamzyMsWIK27F/mv_sp.webp',
    region: { left: 0, top: 0.01, width: 1, height: 0.5 },
    fit: 'contain',
  },
};

export const curatedSource = (code: string, recipe: ArtworkRecipe) =>
  `curated:${code}:${versionFor(JSON.stringify(recipe))}`;

/** Every listed product of one language (first listing wins when a code appears twice). */
export async function fetchProducts(language: Language, fetchImpl: typeof fetch = fetch): Promise<Map<string, ProductEntry>> {
  const site = PRODUCT_SITES[language];
  const products = new Map<string, ProductEntry>();
  for (const category of PRODUCT_CATEGORIES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${site}/products/?subcategory=${category}&page=${page}`;
      const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const entries = parseProductList(await response.text(), site);
      if (entries.length === 0) break;
      for (const entry of entries) if (!products.has(entry.code)) products.set(entry.code, entry);
    }
  }
  return products;
}

/**
 * Artwork for the given product codes, reading each product's page in both languages:
 * a clean key visual from either language first, then a banner (own language first).
 */
export async function fetchArtwork(
  codes: Iterable<string>,
  listings: Partial<Record<Language, Map<string, ProductEntry>>>,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, Artwork>> {
  const out = new Map<string, Artwork>();
  codes = [...codes];
  for (const code of codes) {
    if (CURATED_ARTWORK[code]) continue;
    const found: Artwork[] = [];
    for (const language of ['en', 'ja'] as const) {
      const pageUrl = listings[language]?.get(code)?.pageUrl;
      if (!pageUrl) continue;
      try {
        const response = await fetchImpl(pageUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (!response.ok) continue;
        const artwork = findArtwork(await response.text(), response.url || pageUrl);
        if (artwork) found.push(artwork);
      } catch {
        // one unreadable page must not stop the others
      }
    }
    const best = found.find((a) => a.kind === 'clean') ?? found[0];
    if (best) out.set(code, best);
  }
  // Some products share one page (ST-01–04, ST-15–20): its picture shows all of them together,
  // so it isn't any one product's artwork. Those keep the app's fallback (a card from the set).
  const uses = new Map<string, number>();
  for (const art of out.values()) uses.set(art.url, (uses.get(art.url) ?? 0) + 1);
  for (const [code, art] of out) if ((uses.get(art.url) ?? 0) > 1) out.delete(code);
  // Campaign pages without a usable picture: artwork put together from the page's own pictures.
  for (const code of codes) {
    const recipe = CURATED_ARTWORK[code];
    if (recipe && !out.has(code)) out.set(code, { url: curatedSource(code, recipe), kind: 'curated' });
  }
  return out;
}

export interface ProductStats {
  listed: number;
  matched: number;
  updated: number;
  unmatchedSets: string[];
}

/** Codes of a language's sets that still need artwork (none yet, or not a product-page picture). */
export async function setsNeedingArtwork(client: pg.ClientBase, language: Language): Promise<string[]> {
  const rows = await client.query<{ code: string; source_image_url: string | null }>(
    `select code, source_image_url from public.sets
      where language = $1 and kind not in ('promo', 'other')
        and (source_image_url is null or source_image_url !~* '/mv(_0?1)?\\.(webp|png|jpe?g)$')`,
    [language],
  );
  return rows.rows
    .filter((r) => {
      const recipe = CURATED_ARTWORK[r.code.toUpperCase()];
      return !(recipe && r.source_image_url === curatedSource(r.code.toUpperCase(), recipe));
    })
    .map((r) => r.code.toUpperCase());
}

/**
 * Writes release dates and artwork addresses onto matching sets (same language and code).
 * Only changed rows are touched; nothing is ever cleared.
 */
const PLACEHOLDER_NAME = `regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(code), '[^a-z0-9]', '', 'g')`;

export async function applyProducts(
  client: pg.ClientBase,
  language: Language,
  products: Map<string, ProductEntry>,
  artwork: Map<string, Artwork>,
): Promise<ProductStats> {
  const sets = await client.query<{ id: string; code: string; kind: string }>(
    `select id, code, kind from public.sets where language = $1`,
    [language],
  );
  const stats: ProductStats = { listed: products.size, matched: 0, updated: 0, unmatchedSets: [] };
  for (const set of sets.rows) {
    const code = set.code.toUpperCase();
    const product = products.get(code);
    if (!product) {
      if (set.kind !== 'promo' && set.kind !== 'other') stats.unmatchedSets.push(set.code);
      continue;
    }
    stats.matched++;
    const art = artwork.get(code)?.url ?? null;
    // The name only replaces a placeholder: sets the card data names by their code alone.
    const result = await client.query(
      `update public.sets
          set release_date = coalesce($2::date, release_date),
              source_image_url = coalesce($3, source_image_url),
              name = case when ${PLACEHOLDER_NAME} then coalesce($4, name) else name end
        where id = $1
          and (release_date is distinct from coalesce($2::date, release_date)
               or source_image_url is distinct from coalesce($3, source_image_url)
               or (${PLACEHOLDER_NAME} and $4::text is not null and name is distinct from $4))`,
      [set.id, product.releaseDate, art, productName(product.title)],
    );
    stats.updated += result.rowCount ?? 0;
  }
  return stats;
}

/**
 * Landscape artwork for a set tile. Banners keep only their artwork: the black frame, the pack photo
 * on the right and the text strip at the bottom are cut off. Then a 4:3 crop around the most
 * interesting part (faces, detail).
 */
export async function toArtworkWebp(input: Uint8Array, kind: ArtworkKind): Promise<Uint8Array> {
  let image = sharp(input);
  if (kind === 'banner') {
    const { width = 990, height = 556 } = await image.metadata();
    image = sharp(
      await image
        .extract({
          left: Math.round(width * 0.022),
          top: Math.round(height * 0.032),
          width: Math.round(width * 0.67),
          height: Math.round(height * 0.79),
        })
        .toBuffer(),
    );
  }
  return image
    .resize({ width: ARTWORK_WIDTH, height: ARTWORK_HEIGHT, fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 80 })
    .toBuffer();
}

async function fetchPicture(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Renders a curated artwork recipe (see CURATED_ARTWORK) to the stored 800×600 WebP. */
export async function renderRecipe(recipe: ArtworkRecipe, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const W = ARTWORK_WIDTH;
  const H = ARTWORK_HEIGHT;
  const finish = (image: sharp.Sharp) => image.webp({ quality: 80 }).toBuffer();

  if (recipe.type === 'crop') {
    const input = await fetchPicture(recipe.url, fetchImpl);
    const { width = 1, height = 1 } = await sharp(input).metadata();
    const { left, top, width: w, height: h } = recipe.region;
    const cut = await sharp(input)
      .extract({ left: Math.round(width * left), top: Math.round(height * top), width: Math.round(width * w), height: Math.round(height * h) })
      .toBuffer();
    if (recipe.fit !== 'contain') {
      return finish(sharp(cut).resize({ width: W, height: H, fit: 'cover', position: sharp.strategy.attention }));
    }
    // The empty sides are the picture's own left edge (its plain background) stretched and blurred.
    const cutWidth = Math.round(width * w);
    const strip = await sharp(cut).extract({ left: 0, top: 0, width: Math.max(1, Math.round(cutWidth * 0.12)), height: Math.round(height * h) }).toBuffer();
    const backdrop = await sharp(strip).resize({ width: W, height: H, fit: 'fill' }).blur(16).toBuffer();
    const figure = await sharp(cut).resize({ width: W, height: H, fit: 'inside' }).toBuffer({ resolveWithObject: true });
    return finish(
      sharp(backdrop).composite([{ input: figure.data, left: Math.round((W - figure.info.width) / 2), top: Math.round((H - figure.info.height) / 2) }]),
    );
  }

  if (recipe.type === 'over') {
    const [background, foreground] = await Promise.all([fetchPicture(recipe.background, fetchImpl), fetchPicture(recipe.foreground, fetchImpl)]);
    const base = await sharp(background).resize({ width: W, height: H, fit: 'cover' }).toBuffer();
    const figure = await sharp(foreground)
      .resize({ width: Math.round(W * 0.92), height: Math.round(H * 0.94), fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    return finish(
      sharp(base).composite([
        { input: figure.data, left: Math.round((W - figure.info.width) / 2), top: H - figure.info.height },
      ]),
    );
  }

  // row: equal-width panels, each cropped around its face (attention), with a hairline between.
  const gap = 4;
  const n = recipe.panels.length;
  const panelWidth = Math.floor((W - gap * (n - 1)) / n);
  const backdrop = recipe.panelBackground ? await fetchPicture(recipe.panelBackground, fetchImpl) : null;
  const panels = await Promise.all(
    recipe.panels.map(async (url) => {
      let picture = await fetchPicture(url, fetchImpl);
      if (recipe.keepTop) {
        const { width = 1, height = 1 } = await sharp(picture).metadata();
        picture = await sharp(picture).extract({ left: 0, top: 0, width, height: Math.round(height * recipe.keepTop) }).toBuffer();
      }
      if (backdrop) {
        const { width = 1, height = 1 } = await sharp(picture).metadata();
        const back = await sharp(backdrop).resize({ width, height, fit: 'cover' }).toBuffer();
        picture = await sharp(back).composite([{ input: picture }]).toBuffer();
      }
      return sharp(picture).resize({ width: panelWidth, height: H, fit: 'cover', position: 'top' }).toBuffer();
    }),
  );
  const canvas = sharp({ create: { width: W, height: H, channels: 3, background: '#111111' } });
  return finish(canvas.composite(panels.map((input, i) => ({ input, left: i * (panelWidth + gap), top: 0 }))));
}

const artworkVersion = (sourceUrl: string) => versionFor(`${sourceUrl}#${ARTWORK_VERSION}`);

/**
 * Copies artwork that isn't in Storage yet (or whose official address or crop changed) and points
 * sets.image_url at the copy: sets/<language>/<code>.webp?v=<version>.
 */
export async function mirrorArtwork(
  client: pg.ClientBase,
  store: ImageStore,
  options: { fetchImpl?: typeof fetch; log?: (message: string) => void } = {},
): Promise<{ mirrored: number; failed: number; errors: string[] }> {
  const { fetchImpl = fetch, log = () => {} } = options;
  const rows = await client.query<{ id: string; language: string; code: string; source_image_url: string; image_url: string | null }>(
    `select id, language, code, source_image_url, image_url from public.sets where source_image_url is not null`,
  );
  const result = { mirrored: 0, failed: 0, errors: [] as string[] };
  const todo = rows.rows.filter((row) => !row.image_url?.includes(`v=${artworkVersion(row.source_image_url)}`));
  if (todo.length === 0) return result;
  await store.ensureBucket();
  for (const row of todo) {
    try {
      let webp: Uint8Array;
      if (row.source_image_url.startsWith('curated:')) {
        const recipe = CURATED_ARTWORK[row.code.toUpperCase()];
        if (!recipe) throw new Error('no artwork recipe for this code any more');
        webp = await renderRecipe(recipe, fetchImpl);
      } else {
        const response = await fetchImpl(row.source_image_url, { headers: { 'User-Agent': USER_AGENT } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        webp = await toArtworkWebp(new Uint8Array(await response.arrayBuffer()), artworkKind(row.source_image_url));
      }
      const safeCode = row.code.replace(/[^A-Za-z0-9-]/g, '_');
      const url = await store.upload(`sets/${row.language}/${safeCode}.webp`, webp, 'image/webp');
      await client.query('update public.sets set image_url = $2 where id = $1', [row.id, `${url}?v=${artworkVersion(row.source_image_url)}`]);
      result.mirrored++;
    } catch (error) {
      result.failed++;
      result.errors.push(`${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`set artwork: ${result.mirrored} copied, ${result.failed} failed`);
  return result;
}
