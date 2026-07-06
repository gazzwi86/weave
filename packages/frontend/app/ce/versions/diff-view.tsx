import type { DiffResult } from "./types";

export interface DiffViewProps {
  diff: DiffResult | null;
  loading: boolean;
  error: boolean;
  notFound: boolean;
}

function tripleLine(subject: string, predicate: string, object: string): string {
  return `${subject} ${predicate} ${object}`;
}

/** Draft-vs-latest-published diff (CE-DIFF-1): counts up top, then the
 * added/removed/modified triples themselves -- kept to a scrollable list
 * rather than a full graph diff view for this pass. */
export function DiffView({ diff, loading, error, notFound }: DiffViewProps) {
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading changes…</p>;
  if (error) return <p className="text-[var(--color-danger)]">Could not load the diff.</p>;
  if (notFound || !diff) {
    return <p className="text-[var(--color-text-muted)]">No published baseline to compare against yet.</p>;
  }

  return (
    <div
      data-testid="diff-view"
      className="flex max-h-[300px] flex-col gap-[var(--space-2)] overflow-y-auto rounded-[var(--radius-base)] bg-[var(--color-raised)] p-[var(--space-3)] text-[length:var(--text-caption)]"
    >
      <p className="text-[var(--color-text-default)]">
        {diff.added.length} added · {diff.removed.length} removed · {diff.modified.length} modified
      </p>
      <ul className="flex flex-col gap-[var(--space-1)] font-mono">
        {diff.added.map((triple) => (
          <li key={`added-${triple.subject}-${triple.predicate}-${triple.object}`} className="text-[var(--color-success)]">
            + {tripleLine(triple.subject, triple.predicate, triple.object)}
          </li>
        ))}
        {diff.removed.map((triple) => (
          <li key={`removed-${triple.subject}-${triple.predicate}-${triple.object}`} className="text-[var(--color-danger)]">
            − {tripleLine(triple.subject, triple.predicate, triple.object)}
          </li>
        ))}
        {diff.modified.map((triple) => (
          <li key={`modified-${triple.subject}-${triple.predicate}`} className="text-[var(--color-warn)]">
            ~ {tripleLine(triple.subject, triple.predicate, `${triple.before} → ${triple.after}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
