import { describe, expect, it } from 'vitest';

import { keywordKey, parseEffectText } from './effect-text';
import { legality } from './formats';

describe('parseEffectText', () => {
  it('splits keywords, types and card names out of the text', () => {
    const segments = parseEffectText(
      '[DON!! x1] [When Attacking] If you have a {Land of Wano} type Character, play [Kouzuki Oden].',
    );
    expect(segments).toEqual([
      { type: 'keyword', text: 'DON!! x1', kind: 'don', key: 'donX' },
      { type: 'text', text: ' ' },
      { type: 'keyword', text: 'When Attacking', kind: 'timing', key: 'When Attacking' },
      { type: 'text', text: ' If you have a ' },
      { type: 'trait', text: 'Land of Wano' },
      { type: 'text', text: ' type Character, play ' },
      { type: 'card', text: 'Kouzuki Oden' },
      { type: 'text', text: '.' },
    ]);
  });

  it('knows the colour group of each label', () => {
    const kinds = parseEffectText('[Counter][Trigger][Blocker][Once Per Turn][On K.O.]').map((s) =>
      s.type === 'keyword' ? s.kind : s.type,
    );
    expect(kinds).toEqual(['counter', 'trigger', 'ability', 'limit', 'timing']);
  });

  it('leaves plain text alone', () => {
    expect(parseEffectText('Draw 1 card.')).toEqual([{ type: 'text', text: 'Draw 1 card.' }]);
    expect(parseEffectText('')).toEqual([]);
  });

  it('shares one rules note across DON!! amounts', () => {
    expect(keywordKey('DON!! x2')).toBe('donX');
    expect(keywordKey('Blocker')).toBe('Blocker');
    expect(keywordKey('Roronoa Zoro')).toBeNull();
  });
});

describe('legality', () => {
  it('follows the current Standard block window', () => {
    expect(legality(1)).toBe('extra');
    expect(legality(2)).toBe('standard');
    expect(legality(5)).toBe('standard');
    expect(legality(null)).toBe('unknown');
  });
});
