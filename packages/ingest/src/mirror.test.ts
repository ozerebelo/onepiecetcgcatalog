import pg from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeCatalog } from './db';
import { mirrorImages, toCardWebp, versionFor, type ImageStore } from './mirror';
import type { Normalized } from './normalize';

describe('toCardWebp', () => {
  it('shrinks a card-sized PNG to a 560px WebP', async () => {
    const png = await sharp({ create: { width: 600, height: 838, channels: 3, background: '#c8102e' } }).png().toBuffer();
    const webp = await toCardWebp(png);
    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(560);
  });
});

// Integration tests against a real database with the migrations applied, e.g.
//   scripts/db/test-local.sh --keep  →  TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres pnpm test
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('image mirroring (database)', () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const ids = ['en:ZZ01-001', 'en:ZZ01-002', 'en:ZZ01-003'];

  const catalog = (sourceFor: (id: string) => string): Normalized => ({
    warnings: [],
    sets: [{ id: 'en-999901', language: 'en', source_id: '999901', code: 'ZZ-01', name: 'TEST', kind: 'booster', sort_order: 999901, printing_count: 3 }],
    cards: ['ZZ01-001', 'ZZ01-002', 'ZZ01-003'].map((id) => ({
      id, name: id, name_en: id, name_ja: null, category: 'Character' as const, colors: ['Red' as const], cost: 1, power: 1000,
      counter: null, attributes: [], types: [], effect: null, trigger: null, effect_ja: null, trigger_ja: null, block_number: 1,
    })),
    printings: ids.map((id) => ({
      id, card_id: id.slice(3), language: 'en' as const, code: id.slice(3), variant: 'base' as const, variant_index: 0,
      set_id: 'en-999901', rarity: 'Common' as const, name: id, source_image_url: sourceFor(id), image_url: sourceFor(id),
    })),
  });
  const official = (id: string) => `https://official.example/${id.slice(3)}.png`;

  const cleanup = async () => {
    await client.query("delete from public.printings where set_id = 'en-999901'");
    await client.query("delete from public.cards where id like 'ZZ01-%'");
    await client.query("delete from public.sets where id = 'en-999901'");
  };

  beforeAll(async () => {
    await client.connect();
    await cleanup();
    // Pretend everything else is already mirrored so only the fixture rows are pending.
    await client.query("create temp table saved as select id, image_url from public.printings");
    await client.query("update public.printings set image_url = 'https://already-mirrored/' || id");
  });
  afterAll(async () => {
    await cleanup();
    await client.query('update public.printings p set image_url = s.image_url from saved s where s.id = p.id');
    await client.end();
  });

  it('copies pending images, skips failures, and keeps copies across refreshes', async () => {
    await writeCatalog(client, catalog(official), { source: 'test', revision: null });

    const png = await sharp({ create: { width: 600, height: 838, channels: 3, background: '#2d6cdf' } }).png().toBuffer();
    const uploads = new Map<string, Uint8Array>();
    const store: ImageStore = {
      ensureBucket: async () => {},
      upload: async (path, data) => {
        uploads.set(path, data);
        return `https://storage.example/card-images/${path}`;
      },
    };
    const fakeFetch = (async (url: string) =>
      url.includes('ZZ01-003')
        ? new Response('nope', { status: 403, headers: { 'content-type': 'text/html' } })
        : new Response(new Uint8Array(png), { status: 200, headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;

    const stats = await mirrorImages(client, store, { limit: 100, fetchImpl: fakeFetch });
    expect(stats).toMatchObject({ pending: 3, attempted: 3, mirrored: 2, failed: 1, aborted: false });
    expect(stats.errors[0]).toContain('HTTP 403');
    expect([...uploads.keys()].sort()).toEqual(['en/ZZ01-001.webp', 'en/ZZ01-002.webp']);

    const rows = async () =>
      Object.fromEntries(
        (await client.query<{ id: string; image_url: string }>(
          "select id, image_url from public.printings where set_id = 'en-999901'",
        )).rows.map((r) => [r.id, r.image_url]),
      );
    expect(await rows()).toEqual({
      'en:ZZ01-001': `https://storage.example/card-images/en/ZZ01-001.webp?v=${versionFor(official('en:ZZ01-001'))}`,
      'en:ZZ01-002': `https://storage.example/card-images/en/ZZ01-002.webp?v=${versionFor(official('en:ZZ01-002'))}`,
      'en:ZZ01-003': official('en:ZZ01-003'),
    });

    // Daily refresh with unchanged sources keeps the copies.
    const refresh = await writeCatalog(client, catalog(official), { source: 'test', revision: null });
    expect(refresh.printings.updated).toBe(0);
    expect((await rows())['en:ZZ01-001']).toContain('storage.example');

    // The official image changed: show the new official image until it is copied again.
    const changed = (id: string) => (id === 'en:ZZ01-002' ? 'https://official.example/ZZ01-002-v2.png' : official(id));
    await writeCatalog(client, catalog(changed), { source: 'test', revision: null });
    const after = await rows();
    expect(after['en:ZZ01-001']).toContain('storage.example');
    expect(after['en:ZZ01-002']).toBe('https://official.example/ZZ01-002-v2.png');
  });

  it('gives up early when every download fails', async () => {
    await client.query("update public.printings set image_url = source_image_url where set_id = 'en-999901'");
    const many = await client.query<{ id: string }>("select id from public.printings where set_id = 'en-999901'");
    expect(many.rows.length).toBe(3);
    const failing = (async () => new Response('blocked', { status: 403 })) as unknown as typeof fetch;
    const store: ImageStore = { ensureBucket: async () => {}, upload: async () => 'x' };
    const stats = await mirrorImages(client, store, { limit: 100, fetchImpl: failing, concurrency: 1 });
    expect(stats.mirrored).toBe(0);
    expect(stats.failed).toBe(3);
    expect(stats.aborted).toBe(false); // fewer than 20 attempts: reported, not aborted
  });
});
