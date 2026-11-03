import { describe, expect, it } from 'vitest';

import { normalizeCardId, parsePrintingCode, parsePrintingId, printingId } from './card-id';

describe('parsePrintingCode', () => {
  it('parses a base printing', () => {
    expect(parsePrintingCode('OP01-016')).toEqual({
      cardId: 'OP01-016',
      setPrefix: 'OP01',
      number: 16,
      variant: 'base',
      variantIndex: 0,
    });
  });

  it('parses parallels and reprints', () => {
    expect(parsePrintingCode('OP01-016_p3')).toMatchObject({ cardId: 'OP01-016', variant: 'parallel', variantIndex: 3 });
    expect(parsePrintingCode('OP02-008_r1')).toMatchObject({ cardId: 'OP02-008', variant: 'reprint', variantIndex: 1 });
  });

  it('handles every set prefix shape', () => {
    expect(parsePrintingCode('P-057_p1')).toMatchObject({ cardId: 'P-057', setPrefix: 'P' });
    expect(parsePrintingCode('PRB01-001')).toMatchObject({ cardId: 'PRB01-001', setPrefix: 'PRB01' });
    expect(parsePrintingCode('EB02-010_p10')).toMatchObject({ cardId: 'EB02-010', variantIndex: 10 });
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', 'OP01', 'op01-016', 'OP01-16', 'OP01-016_x1', 'OP01-016_p']) {
      expect(parsePrintingCode(bad)).toBeNull();
    }
  });
});

describe('normalizeCardId', () => {
  it.each([
    ['OP01-016', 'OP01-016'],
    ['op01-016', 'OP01-016'],
    ['OP1-16', 'OP01-016'],
    [' st10-1 ', 'ST10-001'],
    ['p-1', 'P-001'],
    ['OP01 - 016', 'OP01-016'],
    ['OP01-016_p2', 'OP01-016'],
    ['prb01-001', 'PRB01-001'],
  ])('%j -> %j', (input, expected) => {
    expect(normalizeCardId(input)).toBe(expected);
  });

  it.each(['', 'Luffy', '4xOP01-016', 'OP01-0161', 'OP001-016'])('rejects %j', (input) => {
    expect(normalizeCardId(input)).toBeNull();
  });
});

describe('printingId', () => {
  it('round-trips', () => {
    const id = printingId('ja', 'OP05-119_p2');
    expect(id).toBe('ja:OP05-119_p2');
    expect(parsePrintingId(id)).toEqual({ language: 'ja', code: 'OP05-119_p2' });
  });

  it('rejects unknown languages', () => {
    expect(parsePrintingId('fr:OP01-001')).toBeNull();
    expect(parsePrintingId('OP01-001')).toBeNull();
  });
});
