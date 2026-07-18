import { SKOS_DEFINITION, SKOS_PREF_LABEL } from "@/lib/glossary/create-glossary-term";

export interface UpdateGlossaryTermInput {
  prefLabel: string;
  lang: string;
  definition: string;
}

export type GlossaryOpResult =
  | { type: "ok" }
  | { type: "violations"; errors: Record<string, string> }
  | { type: "error"; status: number };

interface ApplyResponseBody {
  violations?: { path: string | null; message: string }[];
}

/** Mirrors `create-glossary-term.ts`'s fallback role for a path-less
 * violation -- prefLabel is the drawer's primary field. */
function mapViolations(violations: ApplyResponseBody["violations"]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const violation of violations ?? []) {
    errors[violation.path ?? SKOS_PREF_LABEL] = violation.message;
  }
  return errors;
}

async function applyOp(op: Record<string, unknown>): Promise<GlossaryOpResult> {
  let response: Response;
  try {
    response = await fetch("/api/operations/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: [op] }),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  if (response.ok) return { type: "ok" };
  if (response.status === 422) {
    const body = (await response.json()) as ApplyResponseBody;
    return { type: "violations", errors: mapViolations(body.violations) };
  }
  return { type: "error", status: response.status };
}

/** Edit-term save: an `update_node` op against the existing CE-WRITE-1
 * proxy (`/api/operations/apply`) -- no new backend endpoint, unlike the
 * Types page's kind-mutation gap (there is no SHACL-shape op there; a
 * glossary term is a plain graph node, so `update_node` applies directly). */
export function updateGlossaryTerm(iri: string, input: UpdateGlossaryTermInput): Promise<GlossaryOpResult> {
  return applyOp({
    op: "update_node",
    iri,
    properties: {
      [SKOS_PREF_LABEL]: [{ value: input.prefLabel, lang: input.lang }],
      [SKOS_DEFINITION]: input.definition,
    },
  });
}

/** Delete-term confirm: a `delete_node` op against the same CE-WRITE-1
 * proxy. */
export function deleteGlossaryTerm(iri: string): Promise<GlossaryOpResult> {
  return applyOp({ op: "delete_node", iri });
}
