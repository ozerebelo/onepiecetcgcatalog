import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMetaDecks, type MetaDeck } from '@binder/core';
import type pg from 'pg';

/** The curated reference lists (see meta/README.md for how to add one). */
export const META_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../meta/meta-decks.json');

/** Reads and validates the meta-deck file; throws with every problem listed. */
export async function readMetaDecks(file = META_FILE): Promise<MetaDeck[]> {
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const { decks, errors } = parseMetaDecks(raw);
  if (errors.length) throw new Error(`${file} has problems:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  return decks;
}

export interface MetaStats {
  upserted: number;
  removed: number;
}

/**
 * Makes the database's meta decks match the file, in one transaction: decks are matched by slug,
 * their lists replaced, and decks no longer in the file removed (they're ours, not users' data).
 * Every card must already be in the catalog; unknown card numbers abort the whole import.
 */
export async function writeMetaDecks(client: pg.Client, decks: MetaDeck[]): Promise<MetaStats> {
  const ids = [...new Set(decks.flatMap((d) => d.items.map((i) => i.card_id)))];
  const known = await client.query<{ id: string }>('select id from public.cards where id = any($1::text[])', [ids]);
  const knownIds = new Set(known.rows.map((r) => r.id));
  const unknown = decks.flatMap((d) => d.items.filter((i) => !knownIds.has(i.card_id)).map((i) => `${d.slug}: ${i.card_id}`));
  if (unknown.length) throw new Error(`Unknown card numbers (import the card data first):\n  - ${unknown.join('\n  - ')}`);

  await client.query('begin');
  try {
    for (const deck of decks) {
      const count = deck.items.reduce((n, i) => n + i.quantity, 0);
      const { rows } = await client.query<{ id: string }>(
        `insert into public.meta_decks
           (slug, archetype, leader_card_id, format, event, event_date, placement, players, player, region, source_name, source_url, card_count, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
         on conflict (slug) do update set
           archetype = excluded.archetype, leader_card_id = excluded.leader_card_id, format = excluded.format,
           event = excluded.event, event_date = excluded.event_date, placement = excluded.placement,
           players = excluded.players, player = excluded.player, region = excluded.region,
           source_name = excluded.source_name, source_url = excluded.source_url,
           card_count = excluded.card_count, updated_at = now()
         returning id`,
        [
          deck.slug,
          deck.archetype,
          deck.leader,
          deck.format,
          deck.event,
          deck.event_date,
          deck.placement ?? null,
          deck.players ?? null,
          deck.player ?? null,
          deck.region ?? null,
          deck.source_name,
          deck.source_url,
          count,
        ],
      );
      const id = rows[0]!.id;
      await client.query('delete from public.meta_deck_cards where meta_deck_id = $1', [id]);
      await client.query(
        `insert into public.meta_deck_cards (meta_deck_id, card_id, quantity)
         select $1, x.card_id, x.quantity from jsonb_to_recordset($2::jsonb) as x(card_id text, quantity integer)`,
        [id, JSON.stringify(deck.items)],
      );
    }
    const removed = await client.query('delete from public.meta_decks where not (slug = any($1::text[]))', [
      decks.map((d) => d.slug),
    ]);
    await client.query('commit');
    return { upserted: decks.length, removed: removed.rowCount ?? 0 };
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
