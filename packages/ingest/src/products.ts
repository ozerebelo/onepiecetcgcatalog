/**
 * Product details from the official "Products" pages: release date and key artwork per set.
 *
 * The card dataset has neither. The official list (one per language) is paginated by category; each
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
const USER_AGENT = 'NakamaBinder-ingest/1.0 (+https://github.com/ozerebelo/onepiecetcgcatalog)';

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

export type ArtworkKind = 'clean' | 'banner';
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
  for (const code of codes) {
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
  const rows = await client.query<{ code: string }>(
    `select code from public.sets
      where language = $1 and kind not in ('promo', 'other')
        and (source_image_url is null or source_image_url !~* '/mv(_0?1)?\\.(webp|png|jpe?g)$')`,
    [language],
  );
  return rows.rows.map((r) => r.code.toUpperCase());
}

/**
 * Writes release dates and artwork addresses onto matching sets (same language and code).
 * Only changed rows are touched; nothing is ever cleared.
 */
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
    const result = await client.query(
      `update public.sets
          set release_date = coalesce($2::date, release_date),
              source_image_url = coalesce($3, source_image_url)
        where id = $1
          and (release_date is distinct from coalesce($2::date, release_date)
               or source_image_url is distinct from coalesce($3, source_image_url))`,
      [set.id, product.releaseDate, art],
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
      const response = await fetchImpl(row.source_image_url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const webp = await toArtworkWebp(new Uint8Array(await response.arrayBuffer()), artworkKind(row.source_image_url));
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
