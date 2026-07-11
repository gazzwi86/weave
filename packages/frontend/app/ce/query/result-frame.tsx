"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { GroundedGraphView } from "./grounded-graph-view";
import { ResultsTable } from "./results-table";
import type { AskResult } from "./use-ask-lifecycle";

export type ResultViewMode = "graph" | "table" | "raw";

const VIEW_MODES: { mode: ResultViewMode; label: string }[] = [
  { mode: "graph", label: "Graph" },
  { mode: "table", label: "Table" },
  { mode: "raw", label: "Raw" },
];

/** CE-V1-TASK-032 AC-5/AC-6: view-mode toggle + tabpanel body -- split out
 * to keep `ResultFrame` under the per-function line budget (Law E). */
function ViewModeToggle({ mode, onChange }: { mode: ResultViewMode; onChange: (mode: ResultViewMode) => void }) {
  return (
    <div role="tablist" aria-label="Result view" className="flex gap-[var(--space-1)]">
      {VIEW_MODES.map((entry) => (
        <button
          key={entry.mode}
          type="button"
          role="tab"
          aria-selected={mode === entry.mode}
          onClick={() => onChange(entry.mode)}
          className="rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body)] aria-selected:bg-[var(--color-surface-selected)] aria-selected:text-[var(--color-text-default)] text-[var(--color-text-muted)]"
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** CE-V1-TASK-032 AC-5/AC-6/AC-7: a single fetched result, rendered as
 * Graph/Table/Raw with a client-side toggle (no re-fetch per view) and an
 * always-available "View SPARQL" disclosure of the exact executed query --
 * shared by both the NL-originated and hand-typed SPARQL-editor paths. */
export function ResultFrame({
  result,
  onCopyToEditor,
}: {
  result: AskResult;
  /** Preserves M1's "copy the NL-generated SPARQL to the editor" action --
   * only wired for the NL-originated ask panel, not the editor's own runs. */
  onCopyToEditor?: (sparql: string) => void;
}) {
  const [mode, setMode] = useState<ResultViewMode>("table");

  return (
    <div data-testid="result-frame" className="flex flex-col gap-[var(--space-3)]">
      <ViewModeToggle mode={mode} onChange={setMode} />

      {mode === "graph" && <GroundedGraphView groundedIris={result.groundedIris} />}
      {mode === "table" && <ResultsTable result={{ columnNames: result.columnNames, rows: result.rows }} />}
      {mode === "raw" && (
        <pre
          data-testid="result-raw"
          className="overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
        >
          {JSON.stringify({ columnNames: result.columnNames, rows: result.rows }, null, 2)}
        </pre>
      )}

      <details data-testid="view-sparql-disclosure">
        <summary className="cursor-pointer text-[length:var(--text-body)] text-[var(--color-text-default)]">
          View SPARQL
        </summary>
        <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)]">
          {result.sparql}
        </pre>
        {onCopyToEditor && (
          <Button variant="secondary" onClick={() => onCopyToEditor(result.sparql)}>
            Copy to editor
          </Button>
        )}
      </details>
    </div>
  );
}
