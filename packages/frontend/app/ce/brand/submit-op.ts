import type { AddNodeOp } from "../chat/types";

export interface ApplyOutcome {
  iri: string | null;
  versionIri: string | null;
  errors: Record<string, string>;
}

interface ApplyResponseBody {
  ref_map?: Record<string, string>;
  version_iri?: string;
  violations?: { path: string | null; message: string }[];
}

/** Shared CE-WRITE-1 dispatch + 422 field-error mapping for the brand
 * standard/voice-rule forms -- same apply/violation-mapping shape as
 * `chat/guided-form.tsx`'s buildOperation/submitForm, generalized to two
 * fixed kinds instead of one dynamically-fetched one.
 *
 * ADR-022 excludes `BrandStandard`/`VoiceRule` from the BPMO catalogue
 * `useKindShape` reads (deliberate -- they're not BPMO kinds), so there's
 * no shape to fetch here; fields are hardcoded from TASK-003's
 * `framework.shacl.ttl` in each form instead, and property keys use the
 * shape's full predicate IRI so a 422's `violation.path` matches a form
 * field directly, same as the catalogue-driven form does.
 */
export async function submitAddNode(op: AddNodeOp, fallbackErrorField: string): Promise<ApplyOutcome> {
  const res = await fetch("/api/operations/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [op] }),
  });
  const body = (await res.json()) as ApplyResponseBody;
  if (res.status === 201) {
    return { iri: body.ref_map?.[op.ref] ?? null, versionIri: body.version_iri ?? null, errors: {} };
  }
  const errors: Record<string, string> = {};
  for (const violation of body.violations ?? []) {
    errors[violation.path ?? fallbackErrorField] = violation.message;
  }
  return { iri: null, versionIri: null, errors };
}
