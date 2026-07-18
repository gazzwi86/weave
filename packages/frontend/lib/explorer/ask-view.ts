import type { BpmoKind } from "@/components/molecules/KindChip";

import { humaniseRelName } from "./humanise-rel-name";
import { toBpmoKind } from "./inspector-view";

export interface AskEntityChip {
  iri: string;
  label: string;
  kind: BpmoKind | null;
}

export interface AskAnswerView {
  sentence: string;
  entities: AskEntityChip[];
  sparql: string;
}

/** The bits of `AskResult` (use-ask-lifecycle.ts) this mapper reads --
 * structural, not a re-export, so ask-view.ts doesn't couple to the /ce/query
 * page's module for a type alone. */
export interface AskViewSourceResult {
  sparql: string;
  rows: Record<string, string>[];
  groundedIris: string[];
}

/** Live-canvas lookup for a grounded iri's already-loaded label/kind --
 * `RendererAdapter.getNodeData`'s return shape, injected so this mapper
 * stays a pure function (testable without a real adapter/cytoscape). */
export type NodeDataLookup = (iri: string) => { label: string; bpmoKind: string } | undefined;

// No NLG "sentence"/"summary" field exists on CE-V1-TASK-007's
// `/api/query/nl` contract (docs/specs/weave/contracts.md) -- this is an
// honest, client-built template (result count + grounded entity names),
// never a fabricated claim beyond what the response actually returned.
function buildSentence(question: string, rowCount: number, entities: AskEntityChip[]): string {
  if (rowCount === 0) return `No results found for "${question}".`;
  const resultWord = rowCount === 1 ? "result" : "results";
  if (entities.length === 0) return `Found ${rowCount} ${resultWord} for "${question}".`;
  const names = entities.map((entity) => entity.label).join(", ");
  return `Found ${rowCount} ${resultWord} for "${question}", grounded in ${names}.`;
}

/** Maps a raw NL-query result to the ask bar's answer panel view: a
 * grounded sentence, kind-coloured entity chips (reusing the inspector's
 * own bpmoKind normaliser), and the generated SPARQL for the collapsible
 * disclosure. */
export function toAskAnswerView(
  result: AskViewSourceResult,
  question: string,
  getNodeData: NodeDataLookup
): AskAnswerView {
  const entities: AskEntityChip[] = result.groundedIris.map((iri) => {
    const known = getNodeData(iri);
    return {
      iri,
      label: known?.label ?? humaniseRelName(iri, []),
      kind: toBpmoKind(known?.bpmoKind),
    };
  });
  return { sentence: buildSentence(question, result.rows.length, entities), entities, sparql: result.sparql };
}
