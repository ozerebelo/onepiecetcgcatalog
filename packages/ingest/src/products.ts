/**
 * Product details from the official "Products" pages: release date and pack image per set.
 *
 * The card dataset has neither. The official list (one per language) is paginated by category; each
 * entry carries the product code in its title ("BOOSTER PACK -ROMANCE DAWN- [OP-01]", Japanese uses
 * 【OP-01】), a <time datetime="YYYY-MM-DD"> and a lazy-loaded image (data-src). Pack images are copied
 * into Storage like card images, because the official site refuses images embedded elsewhere.
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
export const PACK_IMAGE_SIZE = 480;

export interface ProductEntry {
  code: string; // e.g. "OP-17", "OP15-EB04", "ST-01"
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  imageUrl: string | null; // absolute, without the cache-busting query
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
    const src = /<img[^>]*data-src="([^"]+)"/.exec(body)?.[1] ?? /<img[^>]*\ssrc="([^"]+)"/.exec(body)?.[1] ?? null;
    const path = src?.split('?')[0];
    const imageUrl = path && !/img_thumbnail/.test(path) ? new URL(path, site).toString() : null;
    entries.push({ code, title, releaseDate: date, imageUrl });
  }
  return entries;
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

export interface ProductStats {
  listed: number;
  matched: number;
  updated: number;
  unmatchedSets: string[];
}

/**
 * Writes release dates and official pack image addresses onto matching sets (same language and code).
 * Only changed rows are touched; nothing is ever cleared.
 */
export async function applyProducts(client: pg.ClientBase, language: Language, products: Map<string, ProductEntry>): Promise<ProductStats> {
  const sets = await client.query<{ id: string; code: string; kind: string }>(
    `select id, code, kind from public.sets where language = $1`,
    [language],
  );
  const stats: ProductStats = { listed: products.size, matched: 0, updated: 0, unmatchedSets: [] };
  for (const set of sets.rows) {
    const product = products.get(set.code.toUpperCase());
    if (!product) {
      if (set.kind !== 'promo' && set.kind !== 'other') stats.unmatchedSets.push(set.code);
      continue;
    }
    stats.matched++;
    const result = await client.query(
      `update public.sets
          set release_date = coalesce($2::date, release_date),
              source_image_url = coalesce($3, source_image_url),
              image_url = case when $3 is not null and image_url is null then $3 else image_url end
        where id = $1
          and (release_date is distinct from coalesce($2::date, release_date)
               or source_image_url is distinct from coalesce($3, source_image_url))`,
      [set.id, product.releaseDate, product.imageUrl],
    );
    stats.updated += result.rowCount ?? 0;
  }
  return stats;
}

/** Square pack image, small enough for a grid tile. */
export async function toPackWebp(input: Uint8Array): Promise<Uint8Array> {
  return sharp(input)
    .resize({ width: PACK_IMAGE_SIZE, height: PACK_IMAGE_SIZE, fit: 'contain', background: '#ffffff', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Copies pack images that aren't in Storage yet (or whose official address changed) and points
 * sets.image_url at the copy: sets/<language>/<code>.webp?v=<version>.
 */
export async function mirrorPackImages(
  client: pg.ClientBase,
  store: ImageStore,
  options: { fetchImpl?: typeof fetch; log?: (message: string) => void } = {},
): Promise<{ mirrored: number; failed: number; errors: string[] }> {
  const { fetchImpl = fetch, log = () => {} } = options;
  const pending = await client.query<{ id: string; language: string; code: string; source_image_url: string; image_url: string | null }>(
    `select id, language, code, source_image_url, image_url from public.sets
      where source_image_url is not null`,
  );
  const result = { mirrored: 0, failed: 0, errors: [] as string[] };
  const todo = pending.rows.filter((row) => !row.image_url?.includes(`v=${versionFor(row.source_image_url)}`));
  if (todo.length === 0) return result;
  await store.ensureBucket();
  for (const row of todo) {
    try {
      const response = await fetchImpl(row.source_image_url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const webp = await toPackWebp(new Uint8Array(await response.arrayBuffer()));
      const safeCode = row.code.replace(/[^A-Za-z0-9-]/g, '_');
      const url = await store.upload(`sets/${row.language}/${safeCode}.webp`, webp, 'image/webp');
      await client.query('update public.sets set image_url = $2 where id = $1', [row.id, `${url}?v=${versionFor(row.source_image_url)}`]);
      result.mirrored++;
    } catch (error) {
      result.failed++;
      result.errors.push(`${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`pack images: ${result.mirrored} copied, ${result.failed} failed`);
  return result;
}
