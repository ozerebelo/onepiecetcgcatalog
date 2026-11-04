/**
 * Card data import.
 *
 *   pnpm ingest --fetch                       # clone/update punk-records into .cache/ and import
 *   pnpm ingest --source ~/punk-records       # import from an existing checkout
 *   pnpm ingest --fetch --dry-run             # normalize and print a summary, no database needed
 *   pnpm ingest --fetch --mirror-images       # also copy new card images into Supabase Storage
 *   pnpm ingest --mirror-only                 # only copy images (no catalog refresh)
 *   pnpm ingest --fetch --products            # also read release dates + pack images from the official site
 *   pnpm ingest --products-only               # only refresh product details (no catalog refresh)
 *
 * Environment:
 *   DATABASE_URL        Postgres connection string (Supabase: Dashboard → Connect → Session pooler)
 *   DATABASE_CA_CERT    Optional PEM of the Supabase root CA, to verify the server certificate
 *   SUPABASE_SECRET_KEY Secret / service_role key (for --mirror-images; never put it in the app)
 *   SUPABASE_URL        Optional project URL; by default derived from DATABASE_URL
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { LANGUAGES, type Language } from '@binder/core';
import pg from 'pg';

import { connectionConfig, writeCatalog } from './db';
import { mirrorImages, supabaseImageStore, supabaseUrlFromDatabaseUrl } from './mirror';
import { normalize } from './normalize';
import { PRODUCT_SITES, applyProducts, fetchProducts, mirrorPackImages, type ProductEntry } from './products';
import { PUNK_RECORDS_REPO, fetchPunkRecords, gitRevision, readPunkRecords } from './source';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      fetch: { type: 'boolean', default: false },
      languages: { type: 'string', default: LANGUAGES.join(',') },
      'dry-run': { type: 'boolean', default: false },
      'mirror-images': { type: 'boolean', default: false },
      'mirror-only': { type: 'boolean', default: false },
      'mirror-limit': { type: 'string', default: '12000' },
      products: { type: 'boolean', default: false },
      'products-only': { type: 'boolean', default: false },
    },
  });

  if (values['mirror-only']) {
    await runMirror(Number(values['mirror-limit']));
    return;
  }

  const languages = values.languages.split(',').map((l) => l.trim()) as Language[];
  for (const l of languages) {
    if (!LANGUAGES.includes(l)) throw new Error(`Unknown language "${l}" (expected ${LANGUAGES.join(', ')})`);
  }

  if (values['products-only']) {
    await runProducts(languages, { dryRun: values['dry-run'], mirror: true });
    return;
  }

  const sourceDir = values.source
    ? path.resolve(values.source)
    : path.join(REPO_ROOT, '.cache', 'punk-records');
  let revision: string | null;
  if (values.fetch) {
    console.log(`Fetching ${PUNK_RECORDS_REPO} into ${sourceDir} ...`);
    revision = await fetchPunkRecords(sourceDir);
  } else {
    revision = await gitRevision(sourceDir);
  }

  console.log(`Reading ${languages.join(' + ')} card data from ${sourceDir} (revision ${revision ?? 'unknown'})`);
  const raw = await readPunkRecords(sourceDir, languages);
  const data = normalize(raw);

  console.log(
    `Normalized ${data.sets.length} sets, ${data.cards.length} cards, ${data.printings.length} printings` +
      ` (${data.warnings.length} warnings)`,
  );
  for (const warning of data.warnings.slice(0, 50)) console.warn(`  ! ${warning}`);
  if (data.warnings.length > 50) console.warn(`  ! ... and ${data.warnings.length - 50} more`);

  if (values['dry-run']) {
    if (values.products) await runProducts(languages, { dryRun: true, mirror: false });
    console.log('Dry run: nothing written.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set (use --dry-run to skip the database)');

  const client = new pg.Client(connectionConfig(databaseUrl, process.env.DATABASE_CA_CERT || undefined));
  await client.connect();
  try {
    const stats = await writeCatalog(client, data, { source: PUNK_RECORDS_REPO, revision });
    const fmt = (s: { inserted: number; updated: number; unchanged: number }) =>
      `+${s.inserted} new, ${s.updated} updated, ${s.unchanged} unchanged`;
    console.log(`sets:      ${fmt(stats.sets)}`);
    console.log(`cards:     ${fmt(stats.cards)}`);
    console.log(`printings: ${fmt(stats.printings)}`);
    if (stats.stalePrintings > 0) {
      console.log(`note: ${stats.stalePrintings} printings in the database are no longer in the source (kept).`);
    }
  } finally {
    await client.end();
  }

  if (values.products) await runProducts(languages, { dryRun: false, mirror: values['mirror-images'] });
  if (values['mirror-images']) await runMirror(Number(values['mirror-limit']));
}

/**
 * Release dates and pack images from the official product pages. A failure here (the site being down
 * or its markup changing) is reported but never fails the import: the card catalog matters more.
 */
async function runProducts(languages: Language[], { dryRun, mirror }: { dryRun: boolean; mirror: boolean }) {
  const found = new Map<Language, Map<string, ProductEntry>>();
  for (const language of languages) {
    try {
      const products = await fetchProducts(language);
      found.set(language, products);
      console.log(`products (${language}): ${products.size} listed on ${PRODUCT_SITES[language]}`);
    } catch (error) {
      console.warn(`products (${language}): skipped, could not read the product list: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (dryRun) {
    for (const [language, products] of found) {
      for (const p of [...products.values()].slice(0, 5)) console.log(`  ${language} ${p.code} ${p.releaseDate ?? '?'} ${p.imageUrl ?? 'no image'}`);
    }
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const client = new pg.Client(connectionConfig(databaseUrl, process.env.DATABASE_CA_CERT || undefined));
  await client.connect();
  try {
    for (const [language, products] of found) {
      const stats = await applyProducts(client, language, products);
      console.log(`products (${language}): ${stats.matched} sets matched, ${stats.updated} updated`);
      if (stats.unmatchedSets.length) console.log(`  not on the product list: ${stats.unmatchedSets.join(', ')}`);
    }
    if (!mirror) return;
    const supabaseUrl = process.env.SUPABASE_URL || supabaseUrlFromDatabaseUrl(databaseUrl);
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!secretKey || !supabaseUrl) {
      console.warn('Pack images not copied: SUPABASE_SECRET_KEY / SUPABASE_URL missing (official addresses are kept).');
      return;
    }
    const packs = await mirrorPackImages(client, supabaseImageStore(supabaseUrl, secretKey));
    console.log(`pack images: ${packs.mirrored} copied, ${packs.failed} failed`);
    for (const e of packs.errors.slice(0, 20)) console.warn(`  ! ${e}`);
  } finally {
    await client.end();
  }
}

async function runMirror(limit: number) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const supabaseUrl = process.env.SUPABASE_URL || supabaseUrlFromDatabaseUrl(databaseUrl);
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey || !supabaseUrl) {
    // Don't fail the whole import: the catalog refresh already succeeded.
    console.warn(
      !secretKey
        ? 'Image mirroring skipped: the SUPABASE_SECRET_KEY secret is not set (see docs/SETUP.md).'
        : 'Image mirroring skipped: set SUPABASE_URL (it could not be derived from DATABASE_URL).',
    );
    return;
  }
  const client = new pg.Client(connectionConfig(databaseUrl, process.env.DATABASE_CA_CERT || undefined));
  await client.connect();
  try {
    const stats = await mirrorImages(client, supabaseImageStore(supabaseUrl, secretKey), {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 12000,
      log: (m) => console.log(m),
    });
    console.log(
      `images:    ${stats.mirrored} copied, ${stats.failed} failed, ${Math.max(0, stats.pending - stats.mirrored)} still to copy`,
    );
    for (const e of stats.errors) console.warn(`  ! ${e}`);
    if (stats.aborted) {
      throw new Error('Image mirroring stopped: the first 20 downloads/uploads all failed (see errors above).');
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
