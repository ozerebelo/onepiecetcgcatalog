import { describe, expect, it } from 'vitest';

import { listMigrations, parseMigrationFileName } from './migrate';

describe('migration files', () => {
  it('parses Supabase CLI style names', () => {
    expect(parseMigrationFileName('20261104000100_collection.sql')).toEqual({
      version: '20261104000100',
      name: 'collection',
      file: '20261104000100_collection.sql',
    });
    expect(parseMigrationFileName('README.md')).toBeNull();
    expect(parseMigrationFileName('2026_bad.sql')).toBeNull();
  });

  it('lists the repository migrations in order', async () => {
    const files = await listMigrations(new URL('../../../supabase/migrations', import.meta.url).pathname);
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.map((f) => f.version)).toEqual([...files.map((f) => f.version)].sort());
    expect(files[0]?.name).toBe('catalog');
  });
});
