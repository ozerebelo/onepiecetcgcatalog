/**
 * Card data import.
 *
 *   pnpm ingest --fetch                       # clone/update punk-records into .cache/ and import
 *   pnpm ingest --source ~/punk-records       # import from an existing checkout
 *   pnpm ingest --fetch --dry-run             # normalize and print a summary, no database needed
 *   pnpm ingest --fetch --mirror-images       # also copy new card images into Supabase Storage
 *   pnpm ingest --mirror-only                 # only copy images (no catalog refresh)
 *
 * Environment:
 *   DATABASE_URL        Postgres connection string (Supabase: Dashboard → Connect → Session pooler)
 *   DATABASE_CA_CERT    Optional PEM of the Supabase root CA, to verify the server certificate
 *   SUPABASE_URL        Project URL (for --mirror-images)
 *   SUPABASE_SECRET_KEY Secret / service_role key (for --mirror-images; never put it in the app)
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { LANGUAGES, type Language } from '@binder/core';
import pg from 'pg';

import { connectionConfig, writeCatalog } from './db';
import { mirrorImages, supabaseImageStore } from './mirror';
import { normalize } from './normalize';
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

  if (values['mirror-images']) await runMirror(Number(values['mirror-limit']));
}

async function runMirror(limit: number) {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  if (!supabaseUrl || !secretKey) {
    // Don't fail the whole import: the catalog refresh already succeeded.
    console.warn('Image mirroring skipped: SUPABASE_URL and SUPABASE_SECRET_KEY are not set (see docs/SETUP.md).');
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
