import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

/**
 * Applies pending SQL migrations from supabase/migrations, so the database is
 * updated automatically (from GitHub Actions) instead of by hand.
 *
 * History is kept in the same table the Supabase CLI uses
 * (supabase_migrations.schema_migrations), so `supabase db push` / `migration list`
 * stay accurate if anyone uses the CLI later.
 *
 * Databases first set up by pasting files into the SQL Editor have no history. A
 * pending migration whose objects already exist fails inside its transaction with a
 * "duplicate" error; that is taken to mean it was applied by hand, and it is
 * recorded as applied instead of failing the run.
 */

export interface MigrationFile {
  version: string;
  name: string;
  file: string;
}

export interface MigrateResult {
  applied: string[];
  adopted: string[];
  alreadyRecorded: number;
}

// duplicate_table, duplicate_object, duplicate_column, duplicate_function, duplicate_schema
const DUPLICATE_CODES = new Set(['42P07', '42710', '42701', '42723', '42P06']);

/** "20261104000100_collection.sql" -> { version: "20261104000100", name: "collection" } */
export function parseMigrationFileName(file: string): MigrationFile | null {
  const match = /^(\d{14})_([a-z0-9_]+)\.sql$/i.exec(file);
  return match ? { version: match[1]!, name: match[2]!, file } : null;
}

export async function listMigrations(dir: string): Promise<MigrationFile[]> {
  return (await readdir(dir))
    .map(parseMigrationFileName)
    .filter((m): m is MigrationFile => m !== null)
    .sort((a, b) => a.version.localeCompare(b.version));
}

export async function migrate(
  client: pg.ClientBase,
  dir: string,
  log: (message: string) => void = () => {},
): Promise<MigrateResult> {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text not null primary key,
      statements text[],
      name text
    );`);

  const recorded = new Set(
    (await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).rows.map(
      (r) => r.version,
    ),
  );
  const result: MigrateResult = { applied: [], adopted: [], alreadyRecorded: 0 };

  for (const migration of await listMigrations(dir)) {
    if (recorded.has(migration.version)) {
      result.alreadyRecorded += 1;
      continue;
    }
    const sql = await readFile(path.join(dir, migration.file), 'utf8');
    const record = () =>
      client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [
        migration.version,
        migration.name,
        [sql],
      ]);

    await client.query('begin');
    try {
      await client.query(sql);
      await record();
      await client.query('commit');
      result.applied.push(migration.file);
      log(`applied   ${migration.file}`);
    } catch (error) {
      await client.query('rollback');
      const code = (error as { code?: string }).code;
      if (code && DUPLICATE_CODES.has(code)) {
        await record();
        result.adopted.push(migration.file);
        log(`recorded  ${migration.file} (its objects already exist — applied by hand earlier)`);
        continue;
      }
      throw new Error(`Migration ${migration.file} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
