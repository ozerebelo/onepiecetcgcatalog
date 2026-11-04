import pg from 'pg';

import type { Normalized } from './normalize';

export interface UpsertStats {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface IngestStats {
  sets: UpsertStats;
  cards: UpsertStats;
  printings: UpsertStats;
  /** Printings in the database that the source no longer lists. Never deleted: users may own them. */
  stalePrintings: number;
  warnings: number;
}

interface TableSpec {
  table: 'sets' | 'cards' | 'printings';
  /** column name -> Postgres type used to decode the JSON payload */
  columns: Record<string, string>;
  /** Custom SQL for `on conflict do update` (default: take the incoming value). */
  updateExpressions?: Record<string, string>;
  /** Columns ignored when deciding whether a row changed. */
  excludeFromChangeCheck?: string[];
}

const SETS: TableSpec = {
  table: 'sets',
  columns: {
    id: 'text',
    language: 'text',
    source_id: 'text',
    code: 'text',
    name: 'text',
    kind: 'text',
    sort_order: 'integer',
    printing_count: 'integer',
  },
};

const CARDS: TableSpec = {
  table: 'cards',
  columns: {
    id: 'text',
    name_en: 'text',
    name_ja: 'text',
    category: 'text',
    colors: 'text[]',
    cost: 'integer',
    power: 'integer',
    counter: 'integer',
    attributes: 'text[]',
    types: 'text[]',
    effect: 'text',
    trigger: 'text',
    effect_ja: 'text',
    trigger_ja: 'text',
    block_number: 'integer',
  },
};

const PRINTINGS: TableSpec = {
  table: 'printings',
  columns: {
    id: 'text',
    card_id: 'text',
    language: 'text',
    code: 'text',
    variant: 'text',
    variant_index: 'integer',
    set_id: 'text',
    rarity: 'text',
    name: 'text',
    source_image_url: 'text',
    image_url: 'text',
  },
  // image_url may point at our Storage copy of the image (see mirror.ts). Keep it on
  // refreshes, unless the official image address changed — then show the new official
  // image until it is mirrored again.
  updateExpressions: {
    image_url: `case
        when printings.image_url = printings.source_image_url
          or printings.source_image_url is distinct from excluded.source_image_url
        then excluded.image_url
        else printings.image_url
      end`,
  },
  excludeFromChangeCheck: ['image_url'],
};

const CHUNK_SIZE = 2000;

/**
 * Upserts rows via a single jsonb_to_recordset statement per chunk. Rows whose
 * values did not change are left untouched (so updated_at stays meaningful).
 */
async function upsert(client: pg.ClientBase, spec: TableSpec, rows: object[]): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, unchanged: 0 };
  const cols = Object.keys(spec.columns);
  const quoted = cols.map((c) => `"${c}"`);
  const updatable = cols.filter((c) => c !== 'id');
  const compared = updatable.filter((c) => !spec.excludeFromChangeCheck?.includes(c));
  const recordDef = cols.map((c) => `"${c}" ${spec.columns[c]}`).join(', ');

  const sql = `
    insert into public.${spec.table} (${quoted.join(', ')})
    select ${quoted.join(', ')} from jsonb_to_recordset($1::jsonb) as x(${recordDef})
    on conflict (id) do update set
      ${updatable.map((c) => `"${c}" = ${spec.updateExpressions?.[c] ?? `excluded."${c}"`}`).join(',\n      ')}
    where (${compared.map((c) => `${spec.table}."${c}"`).join(', ')})
      is distinct from (${compared.map((c) => `excluded."${c}"`).join(', ')})
    returning (xmax = 0) as inserted`;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => {
      const record = row as Record<string, unknown>;
      return Object.fromEntries(cols.map((c) => [c, record[c] ?? null]));
    });
    const result = await client.query<{ inserted: boolean }>(sql, [JSON.stringify(chunk)]);
    const inserted = result.rows.filter((r) => r.inserted).length;
    stats.inserted += inserted;
    stats.updated += result.rows.length - inserted;
    stats.unchanged += chunk.length - result.rows.length;
  }
  return stats;
}

/** Writes a normalized snapshot in one transaction: either everything lands or nothing does. */
export async function writeCatalog(
  client: pg.ClientBase,
  data: Normalized,
  meta: { source: string; revision: string | null },
): Promise<IngestStats> {
  await client.query('begin');
  try {
    const run = await client.query<{ id: string }>(
      'insert into public.ingest_runs (source, source_revision) values ($1, $2) returning id',
      [meta.source, meta.revision],
    );
    const runId = run.rows[0]!.id;

    // Order matters: printings reference sets and cards.
    const sets = await upsert(client, SETS, data.sets);
    const cards = await upsert(client, CARDS, data.cards);
    const printings = await upsert(client, PRINTINGS, data.printings);

    const stale = await client.query<{ count: string }>(
      'select count(*) from public.printings where not (id = any($1::text[]))',
      [data.printings.map((p) => p.id)],
    );

    const stats: IngestStats = {
      sets,
      cards,
      printings,
      stalePrintings: Number(stale.rows[0]!.count),
      warnings: data.warnings.length,
    };

    await client.query('update public.ingest_runs set finished_at = now(), stats = $2 where id = $1', [
      runId,
      JSON.stringify(stats),
    ]);
    await client.query('commit');
    return stats;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

/**
 * Supabase requires TLS. If the connection string does not say how to do TLS
 * (sslmode=...), connect in plain text to localhost and over TLS elsewhere.
 *
 * Supabase signs database certificates with its own root CA. When that CA is
 * provided (PEM text in `caCert`, from Dashboard → Database → SSL) the server
 * certificate is verified; otherwise the connection is encrypted but unverified,
 * like libpq's `sslmode=require`.
 */
export function connectionConfig(connectionString: string, caCert?: string): pg.ClientConfig {
  const url = new URL(connectionString);
  if (url.searchParams.has('sslmode')) return { connectionString };
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (local) return { connectionString, ssl: false };
  return {
    connectionString,
    ssl: caCert ? { ca: caCert, rejectUnauthorized: true } : { rejectUnauthorized: false },
  };
}
