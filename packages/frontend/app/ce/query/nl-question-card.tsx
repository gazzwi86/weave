import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ResultsTable } from "./results-table";
import type { NlQueryState } from "./use-nl-query";

const NL_ERROR_MESSAGES: Record<string, string> = {
  translation_failed: "Could not translate that question into a query -- try rephrasing it.",
  prohibited_clause: "That question would require a write operation, which is not allowed.",
  service_blocked: "That question would require a federated query, which is not allowed.",
  upstream_unavailable: "Unable to reach the query service.",
};

/** AC-007-06: shows the model's generated SPARQL (transparency) with a
 * one-click "copy to editor" -- split out to keep `NlQuestionCard` under
 * the per-function line budget (Law E).
 */
function GeneratedSparqlBlock({
  sparql,
  onCopyToEditor,
}: {
  sparql: string;
  onCopyToEditor: (sparql: string) => void;
}) {
  return (
    <div data-testid="nl-generated-sparql">
      <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Generated SPARQL
      </p>
      <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)]">
        {sparql}
      </pre>
      <Button variant="secondary" onClick={() => onCopyToEditor(sparql)}>
        Copy to editor
      </Button>
    </div>
  );
}

/** CE-TASK-007 AC-007-01/-04/-05/-06/-08: the natural-language question box
 * -- split out of `page.tsx` to keep each component under the complexity/
 * line-count budget (Law E).
 */
export function NlQuestionCard({
  nl,
  onCopyToEditor,
}: {
  nl: NlQueryState;
  onCopyToEditor: (sparql: string) => void;
}) {
  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Ask a question
      </p>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <Input
          aria-label="Question"
          placeholder="e.g. What processes exist?"
          value={nl.question}
          onChange={(e) => nl.setQuestion(e.target.value)}
        />
        <Button disabled={!nl.question || nl.asking} onClick={() => nl.ask()}>
          {nl.asking ? "Asking…" : "Ask"}
        </Button>

        {nl.errorCode && (
          <p role="alert" data-testid="nl-error" className="text-[var(--color-danger)]">
            {NL_ERROR_MESSAGES[nl.errorCode] ?? "Something went wrong."}
          </p>
        )}

        {nl.sparqlGenerated !== null && (
          <GeneratedSparqlBlock sparql={nl.sparqlGenerated} onCopyToEditor={onCopyToEditor} />
        )}

        {nl.explanation && (
          <p data-testid="nl-explanation" className="text-[var(--color-text-muted)]">
            {nl.explanation}
          </p>
        )}

        {nl.result && <ResultsTable result={nl.result} />}
      </CardContent>
    </Card>
  );
}
