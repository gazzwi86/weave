import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorCard } from "@/components/ui/error-card";

import { ResultFrame } from "./result-frame";
import { ResultsTable } from "./results-table";
import { VersionSelect } from "./version-select";
import type { SparqlEditorState } from "./use-sparql-editor";

/** The editor's three actions (run, explain, coverage_gap report) -- split
 * out to keep `SparqlEditorCard` under the per-function line budget
 * (Law E).
 */
function EditorActions({ editor }: { editor: SparqlEditorState }) {
  return (
    <div className="flex gap-[var(--space-2)]">
      <Button disabled={!editor.queryText || editor.running} onClick={() => editor.runQuery()}>
        {editor.running ? "Running…" : "Run"}
      </Button>
      <Button
        variant="secondary"
        disabled={!editor.queryText || editor.explaining}
        onClick={() => editor.explainQuery()}
      >
        {editor.explaining ? "Explaining…" : "Explain this query"}
      </Button>
      <Button
        variant="secondary"
        disabled={editor.running}
        onClick={() => editor.runPattern("coverage_gap_process")}
      >
        Run coverage gap report
      </Button>
    </div>
  );
}

/** CE-TASK-007 AC-007-09/-10/-11/-12/-13/-14: the raw SPARQL editor and the
 * coverage_gap(process) report action -- split out of `page.tsx` to keep
 * each component under the complexity/line-count budget (Law E).
 * refit-mock.html `.sparql-card`: heading text kept as "SPARQL editor"
 * rather than the mock's "Generated SPARQL — edit and re-run" -- this card
 * is dual-purpose (hand-typed runs + the coverage-gap report), so "Generated"
 * would mislead outside the NL-copy-to-editor flow.
 */
export function SparqlEditorCard({ editor }: { editor: SparqlEditorState }) {
  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        SPARQL editor
      </p>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <textarea
          aria-label="SPARQL query"
          value={editor.queryText}
          onChange={(e) => editor.setQueryText(e.target.value)}
          rows={6}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        />
        <VersionSelect value={editor.version} onChange={editor.setVersion} />
        <EditorActions editor={editor} />

        {editor.errorCode && (
          <ErrorCard data-testid="editor-error" title="Query failed" body={editor.errorCode} />
        )}

        {editor.explanation && (
          <p data-testid="editor-explanation" className="text-[var(--color-text-muted)]">
            {editor.explanation}
          </p>
        )}

        {editor.result && editor.executedSparql !== null && (
          <ResultFrame
            result={{
              sparql: editor.executedSparql,
              rows: editor.result.rows,
              columnNames: editor.result.columnNames,
              groundedIris: [],
            }}
          />
        )}
        {editor.result && editor.executedSparql === null && <ResultsTable result={editor.result} />}
      </CardContent>
    </Card>
  );
}
