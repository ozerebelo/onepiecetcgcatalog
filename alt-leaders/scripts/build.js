// Builds the GitHub Pages site into alt-leaders/dist.
//
//   node scripts/build.js              fetch the sheet + copy card images
//   node scripts/build.js --offline    use data/alt-leaders.csv, no images (quick local check)
//
// 1. Copies the static files (index.html, app.js, …).
// 2. Fetches the published CSV; on success it becomes the page's fallback copy
//    (dist/data/alt-leaders.csv), so the site still shows recent data if Google is unreachable.
// 3. Copies each card's official image once, resized to WebP, into dist/img/.
//    Why: the official card-list site refuses images embedded on other websites
//    (see packages/ingest/src/mirror.ts). Downloads are ordinary, identified requests,
//    cached between runs in .cache/img, so each image is fetched only once.
//    dist/img/index.json lists the copies; the page uses the official address for the rest.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CSV_URL } from '../config.js';
import { officialImageUrl, parseSheet } from '../lib.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const CACHE = join(ROOT, '.cache', 'img');
const STATIC = ['index.html', 'styles.css', 'app.js', 'lib.js', 'config.js', 'favicon.svg'];
const IMAGE_WIDTH = 480; // 2× the widest grid column
const IMAGE_QUALITY = 75;
const USER_AGENT = 'Yonko-alt-leaders/1.0 (+https://github.com/ozerebelo/onepiecetcgcatalog)';

const offline = process.argv.includes('--offline');
const log = (msg) => console.log(msg);
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `aviso: ${msg}`);

async function fetchWithTimeout(url, init = {}, ms = 30_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
  } finally {
    clearTimeout(timer);
  }
}

async function loadSheet() {
  const snapshotPath = join(ROOT, 'data', 'alt-leaders.csv');
  if (!offline) {
    try {
      const res = await fetchWithTimeout(CSV_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const { cards } = parseSheet(text); // throws if it is not the sheet (e.g. a sign-in page)
      if (cards.length === 0) throw new Error('a folha não tem cartas');
      log(`Folha lida: ${cards.length} cartas.`);
      return { text, cards };
    } catch (err) {
      warn(`Não consegui ler a folha publicada (${err.message}); uso a cópia em data/alt-leaders.csv.`);
    }
  }
  const text = await readFile(snapshotPath, 'utf8');
  return { text, cards: parseSheet(text).cards };
}

// Size and quality are in the name, so changing them re-encodes instead of reusing old copies.
const cacheFile = (code) => join(CACHE, `${code}.w${IMAGE_WIDTH}q${IMAGE_QUALITY}.webp`);

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function copyImages(cards) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    warn('sharp não está instalado: sem cópias das imagens (a página usa o endereço oficial).');
    return [];
  }
  await mkdir(CACHE, { recursive: true });
  const codes = [...new Set(cards.map((c) => c.code))].filter((code) => /^[A-Za-z0-9_-]+$/.test(code));
  const done = [];
  let downloaded = 0;
  const failed = [];

  const queue = [...codes];
  async function worker() {
    for (let code = queue.shift(); code; code = queue.shift()) {
      const file = cacheFile(code);
      if (!(await exists(file))) {
        try {
          const res = await fetchWithTimeout(officialImageUrl(code));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('não é uma imagem');
          const png = Buffer.from(await res.arrayBuffer());
          const webp = await sharp(png).resize({ width: IMAGE_WIDTH, withoutEnlargement: true }).webp({ quality: IMAGE_QUALITY }).toBuffer();
          await writeFile(file, webp);
          downloaded++;
        } catch (err) {
          failed.push(`${code} (${err.message})`);
          continue;
        }
      }
      done.push(code);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  await mkdir(join(DIST, 'img'), { recursive: true });
  for (const code of done) await cp(cacheFile(code), join(DIST, 'img', `${code}.webp`));
  log(`Imagens: ${done.length}/${codes.length} (${downloaded} novas).`);
  if (failed.length) warn(`Imagens que falharam (a página usa o endereço oficial): ${failed.join(', ')}`);
  return done.sort();
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(join(DIST, 'data'), { recursive: true });
  for (const file of STATIC) await cp(join(ROOT, file), join(DIST, file));

  const { text, cards } = await loadSheet();
  await writeFile(join(DIST, 'data', 'alt-leaders.csv'), text);

  const images = offline || process.argv.includes('--no-images') ? [] : await copyImages(cards);
  await mkdir(join(DIST, 'img'), { recursive: true });
  await writeFile(join(DIST, 'img', 'index.json'), JSON.stringify(images));
  await writeFile(join(DIST, '.nojekyll'), '');

  const files = await readdir(DIST, { recursive: true });
  log(`dist/ pronto: ${files.length} ficheiros.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
