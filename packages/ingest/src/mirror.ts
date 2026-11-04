import { createHash } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import type pg from 'pg';
import sharp from 'sharp';

/**
 * Copies official card images into our own public Storage bucket, resized to WebP.
 *
 * Why: the official card-list site refuses images embedded on other websites, and
 * the originals are large PNGs. Each image is downloaded once with an ordinary,
 * identified request; apps then load the small copy from our storage/CDN.
 */

export const IMAGE_BUCKET = 'card-images';
export const IMAGE_WIDTH = 560;
const USER_AGENT = 'NakamaBinder-ingest/1.0 (+https://github.com/ozerebelo/onepiecetcgcatalog)';

/** Where mirrored images go. Abstracted so tests can use an in-memory store. */
export interface ImageStore {
  ensureBucket(): Promise<void>;
  /** Uploads (overwriting) and returns the public URL. */
  upload(path: string, data: Uint8Array, contentType: string): Promise<string>;
}

export function supabaseImageStore(supabaseUrl: string, secretKey: string, bucket = IMAGE_BUCKET): ImageStore {
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async ensureBucket() {
      const { data } = await supabase.storage.getBucket(bucket);
      if (data) return;
      const { error } = await supabase.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: ['image/webp'],
        fileSizeLimit: '2MB',
      });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create bucket: ${error.message}`);
    },
    async upload(path, data, contentType) {
      const { error } = await supabase.storage.from(bucket).upload(path, data, {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      });
      if (error) throw new Error(`upload failed: ${error.message}`);
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
  };
}

export interface MirrorOptions {
  /** Max images to process in this run (the daily job only needs the new ones). */
  limit: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

export interface MirrorStats {
  pending: number;
  attempted: number;
  mirrored: number;
  failed: number;
  aborted: boolean;
  errors: string[];
}

interface PendingRow {
  id: string;
  language: string;
  code: string;
  source_image_url: string;
}

/** Resizes any supported image to a card-sized WebP. */
export async function toCardWebp(input: Uint8Array): Promise<Uint8Array> {
  return sharp(input).resize({ width: IMAGE_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
}

/** Cache-busting suffix: changes when the official image address changes. */
export function versionFor(sourceUrl: string): string {
  return createHash('sha1').update(sourceUrl).digest('hex').slice(0, 10);
}

export async function mirrorImages(client: pg.ClientBase, store: ImageStore, options: MirrorOptions): Promise<MirrorStats> {
  const { limit, concurrency = 4, fetchImpl = fetch, log = () => {} } = options;
  const stats: MirrorStats = { pending: 0, attempted: 0, mirrored: 0, failed: 0, aborted: false, errors: [] };

  const pendingCount = await client.query<{ count: string }>(
    'select count(*) from public.printings where image_url = source_image_url',
  );
  stats.pending = Number(pendingCount.rows[0]?.count ?? 0);
  if (stats.pending === 0) return stats;

  await store.ensureBucket();
  const { rows } = await client.query<PendingRow>(
    `select id, language, code, source_image_url from public.printings
     where image_url = source_image_url order by id limit $1`,
    [limit],
  );
  log(`Mirroring ${rows.length} of ${stats.pending} images not yet copied...`);

  let next = 0;
  const worker = async () => {
    while (next < rows.length && !stats.aborted) {
      const row = rows[next++]!;
      stats.attempted += 1;
      try {
        const response = await fetchImpl(row.source_image_url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get('content-type') ?? '';
        if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`);
        const webp = await toCardWebp(new Uint8Array(await response.arrayBuffer()));
        const publicUrl = await store.upload(`${row.language}/${row.code}.webp`, webp, 'image/webp');
        await client.query(
          'update public.printings set image_url = $2 where id = $1 and source_image_url = $3',
          [row.id, `${publicUrl}?v=${versionFor(row.source_image_url)}`, row.source_image_url],
        );
        stats.mirrored += 1;
        if (stats.mirrored % 500 === 0) log(`  ${stats.mirrored} images copied`);
      } catch (error) {
        stats.failed += 1;
        if (stats.errors.length < 10) {
          stats.errors.push(`${row.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
        // If nothing works at all (blocked, wrong credentials), stop instead of hammering.
        if (stats.mirrored === 0 && stats.failed >= 20) stats.aborted = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return stats;
}

/**
 * Supabase connection strings contain the project ref, either in the pooler user name
 * (postgres.<ref>@aws-0-….pooler.supabase.com) or in the direct host (db.<ref>.supabase.co).
 * Returns https://<ref>.supabase.co, or null for non-Supabase databases.
 */
export function supabaseUrlFromDatabaseUrl(databaseUrl: string): string | null {
  try {
    const url = new URL(databaseUrl);
    const fromUser = /^postgres\.([a-z0-9]{15,30})$/i.exec(decodeURIComponent(url.username));
    const fromHost = /^db\.([a-z0-9]{15,30})\.supabase\.co$/i.exec(url.hostname);
    const ref = fromUser?.[1] ?? fromHost?.[1];
    return ref ? `https://${ref.toLowerCase()}.supabase.co` : null;
  } catch {
    return null;
  }
}
