"use client";

import { NlQuestionCard } from "./nl-question-card";
import { SparqlEditorCard } from "./sparql-editor-card";
import { useNlQuery } from "./use-nl-query";
import { useSparqlEditor } from "./use-sparql-editor";

/** CE-TASK-007 E7-S1/E7-S2: natural-language question box (AC-007-01/-04/
 * -05/-06/-08), a raw SPARQL editor (AC-007-09/-10/-11/-14), and the
 * coverage_gap(process) report (AC-007-12/-13) -- one page, three actions
 * sharing the same `ResultsTable`.
 */
export default function QueryPage() {
  const nl = useNlQuery();
  const editor = useSparqlEditor();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Query the graph
      </h1>

      <NlQuestionCard nl={nl} onCopyToEditor={editor.setQueryText} />
      <SparqlEditorCard editor={editor} />
    </main>
  );
}
