/**
 * Applies pending database migrations.
 *
 *   DATABASE_URL=... pnpm db:migrate
 *
 * Run automatically by the "Update database & card data" GitHub workflow.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { connectionConfig } from './db';
import { migrate } from './migrate';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const client = new pg.Client(connectionConfig(databaseUrl, process.env.DATABASE_CA_CERT || undefined));
  await client.connect();
  try {
    const result = await migrate(client, MIGRATIONS_DIR, (m) => console.log(m));
    console.log(
      `migrations: ${result.applied.length} applied, ${result.adopted.length} recorded as already present, ` +
        `${result.alreadyRecorded} up to date`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
