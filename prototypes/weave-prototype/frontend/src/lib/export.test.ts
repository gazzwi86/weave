import { describe, expect, it } from 'vitest';
import { toCsv, toMarkdownTable } from './export';

const headers = ['Name', 'Count'];
const rows = [
  ['Alice', '3'],
  ['Bob, Jr.', '1'],
  ['Carol "C"', '2'],
];

describe('toCsv', () => {
  it('quotes all fields', () => {
    const csv = toCsv(headers, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Name","Count"');
    expect(lines[1]).toBe('"Alice","3"');
  });

  it('escapes internal double-quotes', () => {
    const csv = toCsv(headers, rows);
    expect(csv).toContain('"Carol ""C"""');
  });

  it('escapes commas inside fields', () => {
    const csv = toCsv(headers, rows);
    expect(csv).toContain('"Bob, Jr."');
  });
});

describe('toMarkdownTable', () => {
  it('includes a separator row after the header', () => {
    const md = toMarkdownTable(headers, rows);
    const lines = md.split('\n');
    expect(lines[1]).toMatch(/^\|[-| ]+\|$/);
  });

  it('pads cells to equal column widths', () => {
    const md = toMarkdownTable(headers, rows);
    // All rows in the column should be the same width
    const colWidths = md
      .split('\n')
      .filter((l) => l.startsWith('|'))
      .map((l) => l.split('|')[1].length);
    const unique = new Set(colWidths);
    expect(unique.size).toBe(1);
  });
});
