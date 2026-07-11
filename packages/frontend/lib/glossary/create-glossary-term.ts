export const SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept";
export const OWL_CLASS = "http://www.w3.org/2002/07/owl#Class";
export const SKOS_PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
export const SKOS_DEFINITION = "http://www.w3.org/2004/02/skos/core#definition";

export interface CreateGlossaryTermInput {
  prefLabel: string;
  lang: string;
  definition: string;
}

export type CreateGlossaryTermResult =
  | { type: "ok"; iri: string }
  | { type: "violations"; errors: Record<string, string> }
  | { type: "error"; status: number };

interface ApplyResponseBody {
  ref_map?: Record<string, string>;
  violations?: { path: string | null; message: string }[];
}

function buildOp(input: CreateGlossaryTermInput) {
  return {
    op: "add_node" as const,
    ref: "t1",
    kind: SKOS_CONCEPT,
    label: input.prefLabel,
    additional_types: [OWL_CLASS],
    properties: {
      [SKOS_PREF_LABEL]: [{ value: input.prefLabel, lang: input.lang }],
      [SKOS_DEFINITION]: input.definition,
    },
  };
}

/** A violation with no `path` (e.g. a shape-level constraint) still needs a
 * field to land on -- prefLabel is the form's primary/required field, same
 * fallback role `guided-form.tsx`'s LABEL_FIELD plays for generic kinds. */
function mapViolations(violations: { path: string | null; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const violation of violations) {
    errors[violation.path ?? SKOS_PREF_LABEL] = violation.message;
  }
  return errors;
}

/** AC-002-02/AC-002-04: creates a glossary term via the existing CE-WRITE-1
 * proxy (`/api/operations/apply`) -- no new backend endpoint. Punned
 * `owl:Class` typing and the lang-tagged `skos:prefLabel` value are exactly
 * the shape `GlossaryTermShape` (TASK-001) requires; a `sh:uniqueLang` 422
 * comes back naming the colliding language and is mapped onto the
 * `skos:prefLabel` field. Never throws: every failure resolves to
 * `{type: "error", status}`. */
export async function createGlossaryTerm(input: CreateGlossaryTermInput): Promise<CreateGlossaryTermResult> {
  let response: Response;
  try {
    response = await fetch("/api/operations/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: [buildOp(input)] }),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  const body = (await response.json()) as ApplyResponseBody;

  if (response.status === 201) {
    return { type: "ok", iri: body.ref_map?.t1 ?? "" };
  }
  if (response.status === 422) {
    return { type: "violations", errors: mapViolations(body.violations ?? []) };
  }
  return { type: "error", status: response.status };
}
