import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Language } from '@binder/core';

const run = promisify(execFile);

/** Card record as published by punk-records (scraped from the official card list). */
export interface RawCard {
  id: string;
  pack_id: string;
  name: string;
  rarity: string;
  category: string;
  img_url?: string;
  img_full_url: string;
  colors: string[];
  cost: number | null;
  attributes: string[];
  power: number | null;
  counter: number | null;
  types: string[];
  effect: string | null;
  trigger: string | null;
  block_number?: number | null;
}

export interface RawPack {
  id: string;
  raw_title?: string;
  title_parts?: { prefix?: string | null; title?: string | null; label?: string | null };
}

export interface LanguageSource {
  packs: Record<string, RawPack>;
  cards: RawCard[];
}

export type RawSource = Partial<Record<Language, LanguageSource>>;

export const PUNK_RECORDS_REPO = 'https://github.com/buhbbl/punk-records.git';

const FOLDER_BY_LANGUAGE: Record<Language, string> = {
  en: 'english',
  ja: 'japanese',
};

/** Reads `<root>/<language folder>/{packs.json,data/*.json}` for each requested language. */
export async function readPunkRecords(root: string, languages: readonly Language[]): Promise<RawSource> {
  const source: RawSource = {};
  for (const language of languages) {
    const dir = path.join(root, FOLDER_BY_LANGUAGE[language]);
    if (!existsSync(dir)) throw new Error(`Missing ${language} data folder: ${dir}`);

    const packsJson = JSON.parse(await readFile(path.join(dir, 'packs.json'), 'utf8')) as
      | Record<string, RawPack>
      | RawPack[];
    const packs = Array.isArray(packsJson)
      ? Object.fromEntries(packsJson.map((p) => [p.id, p]))
      : packsJson;

    const dataDir = path.join(dir, 'data');
    const files = (await readdir(dataDir)).filter((f) => f.endsWith('.json')).sort();
    const cards: RawCard[] = [];
    for (const file of files) {
      const parsed = JSON.parse(await readFile(path.join(dataDir, file), 'utf8')) as RawCard[];
      cards.push(...parsed);
    }
    source[language] = { packs, cards };
  }
  return source;
}

/** Shallow-clones (or fast-forwards) the dataset into `dir`. Returns the checked-out commit. */
export async function fetchPunkRecords(dir: string): Promise<string> {
  if (existsSync(path.join(dir, '.git'))) {
    await run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', 'HEAD']);
    await run('git', ['-C', dir, 'reset', '--hard', 'FETCH_HEAD']);
  } else {
    await run('git', ['clone', '--depth', '1', PUNK_RECORDS_REPO, dir]);
  }
  return gitRevision(dir) as Promise<string>;
}

export async function gitRevision(dir: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['-C', dir, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return null;
  }
}
