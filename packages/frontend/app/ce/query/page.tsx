"use client";

import { AskPanel } from "./ask-panel";
import { SparqlEditorCard } from "./sparql-editor-card";
import { useAskLifecycle } from "./use-ask-lifecycle";
import { useSparqlEditor } from "./use-sparql-editor";

/** CE-V1-TASK-032 (rebuilds CE-TASK-007 E7-S1/E7-S2's UI): ask lifecycle
 * (submitting/provider-missing/timeout/error/success, AC-1..AC-4) + shared
 * Graph/Table/Raw `ResultFrame` (AC-5..AC-8), raw SPARQL editor unchanged
 * (AC-9) -- one page, two panels.
 */
export interface QueryPageProps {
  /** Test seam -- overrides the ask lifecycle's default 310s timeout. */
  timeoutMs?: number;
}

export default function QueryPage({ timeoutMs }: QueryPageProps = {}) {
  const nl = useAskLifecycle(timeoutMs);
  const editor = useSparqlEditor();

  return (
    <main data-tour-id="ce.query" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Query graph
      </h1>
      <AskPanel nl={nl} onCopyToEditor={editor.setQueryText} />
      <SparqlEditorCard editor={editor} />
    </main>
  );
}
