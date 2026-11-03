/**
 * Minimal RFC 4180 CSV support: quoted fields, escaped quotes (""), delimiters
 * and newlines inside quotes, CRLF. Delimiter is auto-detected (comma, semicolon
 * — Excel in many European locales — or tab).
 */

export type CsvDelimiter = ',' | ';' | '\t';

export function detectDelimiter(headerLine: string): CsvDelimiter {
  const counts: [CsvDelimiter, number][] = [
    [',', headerLine.split(',').length - 1],
    [';', headerLine.split(';').length - 1],
    ['\t', headerLine.split('\t').length - 1],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}

/** Parses CSV text into rows of raw string cells. Each row carries its 1-based starting line number. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): { cells: string[]; line: number }[] {
  const input = text.replace(/^﻿/, ''); // strip BOM (Excel exports)
  const sep = delimiter ?? detectDelimiter(input.split(/\r?\n/, 1)[0] ?? '');
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;

  const endRow = () => {
    cells.push(field);
    if (cells.length > 1 || cells[0]!.trim() !== '') rows.push({ cells, line: rowStart });
    cells = [];
    field = '';
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
    } else if (ch === sep) {
      cells.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStart = line;
    } else {
      field += ch;
    }
  }
  if (field !== '' || cells.length > 0) endRow();
  return rows;
}

/** Quotes a cell when needed. */
export function csvCell(value: string | number | null | undefined, delimiter: CsvDelimiter = ','): string {
  const text = value == null ? '' : String(value);
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][], delimiter: CsvDelimiter = ','): string {
  return rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join('\r\n') + '\r\n';
}
