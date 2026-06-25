function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Serialise headers + rows as RFC-4180 CSV (all fields double-quoted). */
export function toCsv(headers: string[], rows: string[][]): string {
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');
}

/** Serialise headers + rows as a GitHub-flavoured Markdown table. */
export function toMarkdownTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const pad = (s: string, w: number) => s.padEnd(w);
  const row = (cells: string[]) => `| ${cells.map((c, i) => pad(c, widths[i])).join(' | ')} |`;
  const sep = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  return [row(headers), sep, ...rows.map(row)].join('\n');
}

export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  download(filename, toCsv(headers, rows), 'text/csv;charset=utf-8');
}

export function exportMarkdown(filename: string, headers: string[], rows: string[][]) {
  download(filename, toMarkdownTable(headers, rows), 'text/markdown;charset=utf-8');
}
