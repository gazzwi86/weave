import type { QueryResult } from "./types";

/** CE-TASK-007 AC-007-13: renders the zero-gap message in place of an empty
 * table -- shared by the NL query, editor, and coverage_gap report results.
 */
export function ResultsTable({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return (
      <p data-testid="results-empty" className="text-[var(--color-text-muted)]">
        {result.message ?? "No results found"}
      </p>
    );
  }

  return (
    <table data-testid="results-table" className="w-full border-collapse text-left">
      <thead>
        <tr>
          {result.columnNames.map((name) => (
            <th
              key={name}
              className="border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
            >
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row, index) => (
          // ponytail: index key is fine here -- rows are a read-only query
          // snapshot, never reordered/edited in place.
          <tr key={index}>
            {result.columnNames.map((name) => (
              <td
                key={name}
                className="border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
              >
                {row[name] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
