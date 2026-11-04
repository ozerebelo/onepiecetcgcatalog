import { describe, expect, it } from 'vitest';

import { parseProductList, productCode } from './products';

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
        imageUrl: 'https://en.onepiece-cardgame.com/onepiececg/bccard/en/products/2026/09/18/rGCJ1ZUyi5qrA7zL/img_item01.webp',
      },
      {
        code: 'ST-36',
        title: 'STARTER DECK -YELLOW Eustass"Captain"Kid- [ST-36]',
        releaseDate: '2026-07-31',
        imageUrl: 'https://en.onepiece-cardgame.com/onepiececg/bccard/en/products/st36/img_item01.webp',
      },
    ]);
  });
  it('handles the Japanese list', () => {
    const [entry] = parseProductList(JA, 'https://www.onepiece-cardgame.com');
    expect(entry).toMatchObject({ code: 'OP-15', releaseDate: '2026-02-28' });
    expect(entry?.imageUrl).toBe('https://www.onepiece-cardgame.com/onepiececg/bccard/jp/products/op15/img_item01.webp');
  });
  it('returns nothing for a page past the end of the list', () => {
    expect(parseProductList('<ul class="linkListCol"></ul>', 'https://en.onepiece-cardgame.com')).toEqual([]);
  });
});
