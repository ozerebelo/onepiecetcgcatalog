import { describe, expect, it } from 'vitest';

import sharp from 'sharp';

import { ARTWORK_HEIGHT, ARTWORK_WIDTH, artworkKind, fetchArtwork, findArtwork, parseProductList, productCode, productName, toArtworkWebp } from './products';

// Excerpts of the official product lists (en.onepiece-cardgame.com / www.onepiece-cardgame.com).
const EN = `
<li class="linkListColBox" data-cat="boosters">
  <a href="https://en.onepiece-cardgame.com/products/op18.html" class="linkListColItem">
    <div class="linkListColThumb">
      <img class="lazy" src="/renewal/images/common/thumbnail/img_thumbnail_sq.webp" data-src="/onepiececg/bccard/en/products/2026/09/18/rGCJ1ZUyi5qrA7zL/img_item01.webp?_=52a7" alt="">
    </div>
    <div class="linkListColDetail">
      <div class="linkListColHead"><span class="linkListColCat">BOOSTERS</span></div>
      <h4 class="linkListColTitle">BOOSTER PACK  -THE DOMINANCE OF GOD- [OP-18]</h4>
      <p class="linkListColDate"><span class="head">Release Date</span><time class="newsDate" datetime="2026-11-20">November 20, 2026</time></p>
    </div>
  </a>
</li>
<li class="linkListColBox" data-cat="decks">
  <a href="https://en.onepiece-cardgame.com/products/st36.html" class="linkListColItem">
    <div class="linkListColThumb"><img class="lazy" src="/renewal/images/common/thumbnail/img_thumbnail_sq.webp" data-src="/onepiececg/bccard/en/products/st36/img_item01.webp" alt=""></div>
    <div class="linkListColDetail">
      <h4 class="linkListColTitle">STARTER DECK -YELLOW Eustass&quot;Captain&quot;Kid- [ST-36]</h4>
      <p class="linkListColDate"><time class="newsDate" datetime="2026-07-31">July 31, 2026</time></p>
    </div>
  </a>
</li>
<li class="linkListColBox" data-cat="decks">
  <a href="#" class="linkListColItem">
    <div class="linkListColThumb"><img class="lazy" src="/renewal/images/common/thumbnail/img_thumbnail_sq.webp" alt=""></div>
    <div class="linkListColDetail">
      <h4 class="linkListColTitle">STARTER DECK -Straw Hat Crew- [ST-01 PRE]</h4>
    </div>
  </a>
</li>
<li class="linkListColBox" data-cat="decks">
  <a href="#" class="linkListColItem"><h4 class="linkListColTitle">Learn Together Deck Set</h4></a>
</li>`;

const JA = `
<li class="linkListColBox" data-cat="boosters">
  <a href="https://www.onepiece-cardgame.com/products/op15.html" class="linkListColItem">
    <div class="linkListColThumb"><img class="lazy" src="/renewal/images/common/thumbnail/img_thumbnail_sq.webp" data-src="/onepiececg/bccard/jp/products/op15/img_item01.webp?_=1" alt=""></div>
    <div class="linkListColDetail">
      <h4 class="linkListColTitle">ブースターパック 神の島の冒険【OP-15】</h4>
      <p class="linkListColDate"><time class="newsDate" datetime="2026-02-28">2026年2月28日</time></p>
    </div>
  </a>
</li>`;

describe('productCode', () => {
  it('reads [CODE] and 【CODE】 at the end of a title', () => {
    expect(productCode('BOOSTER PACK -ROMANCE DAWN- [OP-01]')).toBe('OP-01');
    expect(productCode('BOOSTER PACK -ADVENTURE ON KAMI’S ISLAND- [OP15-EB04]')).toBe('OP15-EB04');
    expect(productCode('ブースターパック 神の島の冒険【OP-15】')).toBe('OP-15');
    expect(productCode('STARTER DECK -Baroque Works-  [ST-38]')).toBe('ST-38');
  });
  it('ignores pre-release editions and titles without a code', () => {
    expect(productCode('STARTER DECK -Straw Hat Crew- [ST-01 PRE]')).toBeNull();
    expect(productCode('Learn Together Deck Set')).toBeNull();
  });
});

describe('parseProductList', () => {
  it('reads code, title, release date and the lazy-loaded image', () => {
    const entries = parseProductList(EN, 'https://en.onepiece-cardgame.com');
    expect(entries).toEqual([
      {
        code: 'OP-18',
        title: 'BOOSTER PACK -THE DOMINANCE OF GOD- [OP-18]',
        releaseDate: '2026-11-20',
        pageUrl: 'https://en.onepiece-cardgame.com/products/op18.html',
      },
      {
        code: 'ST-36',
        title: 'STARTER DECK -YELLOW Eustass"Captain"Kid- [ST-36]',
        releaseDate: '2026-07-31',
        pageUrl: 'https://en.onepiece-cardgame.com/products/st36.html',
      },
    ]);
  });
  it('handles the Japanese list', () => {
    const [entry] = parseProductList(JA, 'https://www.onepiece-cardgame.com');
    expect(entry).toMatchObject({ code: 'OP-15', releaseDate: '2026-02-28' });
    expect(entry?.pageUrl).toBe('https://www.onepiece-cardgame.com/products/op15.html');
  });
  it('returns nothing for a page past the end of the list', () => {
    expect(parseProductList('<ul class="linkListCol"></ul>', 'https://en.onepiece-cardgame.com')).toEqual([]);
  });
});

describe('findArtwork', () => {
  it('prefers the clean key visual of newer product pages', () => {
    const html = `
      <img src="/onepiececg/bccard/jp/products/2026/06/01/7oygO6ykp1b2qTGo/bg_mv.webp" alt="">
      <img src="/onepiececg/bccard/en/products/2026/07/08/e9kPAYzpFy1Ic3Tm/img_item01.webp" alt="pack">
      <img src="/onepiececg/bccard/jp/products/2026/06/01/5ePgZUqO53ZH0cNN/mv.webp" alt="">`;
    expect(findArtwork(html, 'https://en.onepiece-cardgame.com/products/st36.html')).toEqual({
      url: 'https://en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/5ePgZUqO53ZH0cNN/mv.webp',
      kind: 'clean',
    });
  });
  it('falls back to the banner of older pages, resolving relative paths', () => {
    const html = `<img src="../../images/products/boosters/op01/mv_01.jpg?v3" alt="">`;
    expect(findArtwork(html, 'https://en.onepiece-cardgame.com/products/boosters/op01.php')).toEqual({
      url: 'https://en.onepiece-cardgame.com/images/products/boosters/op01/mv_01.jpg',
      kind: 'banner',
    });
  });
  it('ignores other "mv" pictures such as logos and decorations', () => {
    const html = `<img src="./images/mv_logo.png"><img src="./images/mv_balloon01.png">`;
    expect(findArtwork(html, 'https://en.onepiece-cardgame.com/products/boosters/op05/')).toBeNull();
  });
  it('tells banners from clean artwork by file name', () => {
    expect(artworkKind('https://x/images/products/decks/st10/mv_01.jpg')).toBe('banner');
    expect(artworkKind('https://x/renewal/images/products/decks/st23/mv.webp')).toBe('clean');
  });
});

describe('toArtworkWebp', () => {
  it('crops banners and clean artwork to the same landscape size', async () => {
    const banner = await sharp({ create: { width: 990, height: 556, channels: 3, background: '#335' } }).png().toBuffer();
    const square = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#a33' } }).png().toBuffer();
    for (const [input, kind] of [
      [banner, 'banner'],
      [square, 'clean'],
    ] as const) {
      const meta = await sharp(await toArtworkWebp(new Uint8Array(input), kind)).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([ARTWORK_WIDTH, ARTWORK_HEIGHT, 'webp']);
    }
  });
});

describe('fetchArtwork', () => {
  const page = (img: string) => new Response(`<img src="${img}">`, { status: 200 });
  const listing = (codes: string[]) =>
    new Map(codes.map((code) => [code, { code, title: code, releaseDate: null, pageUrl: `https://en.onepiece-cardgame.com/products/${code}.html` }]));

  it('drops a picture that several products share (one page for several decks)', async () => {
    const fetchImpl = (async (url: string) =>
      url.includes('ST-01') || url.includes('ST-02') ? page('/images/products/decks/st01-04/mv_01.jpg') : page('/x/st21/mv.webp')) as typeof fetch;
    const art = await fetchArtwork(['ST-01', 'ST-02', 'ST-21'], { en: listing(['ST-01', 'ST-02', 'ST-21']) }, fetchImpl);
    expect([...art.keys()]).toEqual(['ST-21']);
  });

  it('prefers clean artwork from the other language over its own banner', async () => {
    const fetchImpl = (async (url: string) =>
      url.startsWith('https://en.') ? page('/images/products/boosters/op10/mv_01.jpg') : page('/renewal/images/products/boosters/op10/mv.webp')) as typeof fetch;
    const ja = new Map([['OP-10', { code: 'OP-10', title: 'OP-10', releaseDate: null, pageUrl: 'https://www.onepiece-cardgame.com/products/op10.html' }]]);
    const art = await fetchArtwork(['OP-10'], { en: listing(['OP-10']), ja }, fetchImpl);
    expect(art.get('OP-10')).toEqual({ url: 'https://www.onepiece-cardgame.com/renewal/images/products/boosters/op10/mv.webp', kind: 'clean' });
  });
});

describe('productName', () => {
  it('takes the name between the dashes of an English title', () => {
    expect(productName('BOOSTER PACK -ADVENTURE ON KAMI’S ISLAND- [OP15-EB04]')).toBe('ADVENTURE ON KAMI’S ISLAND');
    expect(productName('BOOSTER PACK  -THE DOMINANCE OF GOD- [OP-18]')).toBe('THE DOMINANCE OF GOD');
    expect(productName('EXTRA BOOSTER -ONE PIECE HEROINES EDITION vol.2- [EB-05]')).toBe('ONE PIECE HEROINES EDITION vol.2');
    expect(productName('STARTER DECK -YELLOW Eustass"Captain"Kid- [ST-36]')).toBe('YELLOW Eustass"Captain"Kid');
    expect(productName('Mini Case Set -Luffy/Shanks/Hancock- [TS-03]')).toBe('Luffy/Shanks/Hancock');
  });
  it('drops the product type from a Japanese title', () => {
    expect(productName('ブースターパック 神の島の冒険【OP-15】')).toBe('神の島の冒険');
    expect(productName('エクストラブースター EGGHEAD CRISIS【EB-04】')).toBe('EGGHEAD CRISIS');
    expect(productName('スタートデッキEX ルフィ&エース【ST-30】')).toBe('ルフィ&エース');
  });
  it('keeps titles without a type or dashes whole', () => {
    expect(productName('Devil Fruits Collection Vol.1 [DF-01]')).toBe('Devil Fruits Collection Vol.1');
    expect(productName('[OP-01]')).toBeNull();
  });
});
