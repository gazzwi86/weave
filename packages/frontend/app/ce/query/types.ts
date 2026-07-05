/** CE-TASK-007: shared result shape the NL query, the SPARQL editor, and
 * the coverage_gap report all render through the same `ResultsTable`.
 */
export interface QueryResult {
  columnNames: string[];
  rows: Record<string, string>[];
  message?: string;
}

/** A SPARQL 1.1 JSON binding value, e.g. `{ type: "uri", value: "urn:x" }`. */
interface SparqlBindingValue {
  value: string;
}

/** Mirrors the backend's `rdf/results.bindings_to_rows` -- extracts each
 * bound column's `.value`, omitting a column that's unbound (e.g.
 * OPTIONAL) for a given row rather than throwing.
 */
export function bindingsToRows(
  bindings: Record<string, SparqlBindingValue>[],
  columnNames: string[]
): Record<string, string>[] {
  return bindings.map((binding) => {
    const row: Record<string, string> = {};
    for (const name of columnNames) {
      const bound = binding[name];
      if (bound !== undefined) {
        row[name] = bound.value;
      }
    }
    return row;
  });
}
