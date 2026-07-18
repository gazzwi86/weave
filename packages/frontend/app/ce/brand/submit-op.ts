import type { AddNodeOp, Op } from "../chat/types";

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
async function applyOne(op: Op): Promise<{ status: number; body: ApplyResponseBody }> {
  const res = await fetch("/api/operations/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [op] }),
  });
  return { status: res.status, body: (await res.json()) as ApplyResponseBody };
}

function violationErrors(body: ApplyResponseBody, fallbackErrorField: string): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const violation of body.violations ?? []) {
    errors[violation.path ?? fallbackErrorField] = violation.message;
  }
  return errors;
}

export async function submitAddNode(op: AddNodeOp, fallbackErrorField: string): Promise<ApplyOutcome> {
  const { status, body } = await applyOne(op);
  if (status === 201) {
    return { iri: body.ref_map?.[op.ref] ?? null, versionIri: body.version_iri ?? null, errors: {} };
  }
  return { iri: null, versionIri: null, errors: violationErrors(body, fallbackErrorField) };
}

/** Same 201/422 dispatch as `submitAddNode`, for an existing entity's
 * `update_node` op (edit drawers on the brand/standards tabs). `iri` is
 * caller-known (not minted), so on success it's just echoed back for a
 * uniform `ApplyOutcome` shape the drawer callers can share with create.
 */
export async function submitUpdateNode(
  iri: string,
  properties: Record<string, unknown>,
  fallbackErrorField: string
): Promise<ApplyOutcome> {
  const { status, body } = await applyOne({ op: "update_node", iri, properties });
  if (status === 201) {
    return { iri, versionIri: body.version_iri ?? null, errors: {} };
  }
  return { iri: null, versionIri: null, errors: violationErrors(body, fallbackErrorField) };
}

export interface DeleteOutcome {
  ok: boolean;
  errorMessage: string | null;
}

const GENERIC_DELETE_ERROR = "Could not delete. Please try again.";

/** `delete_node` has no field to anchor a violation on (there's no form),
 * so any 422 message surfaces as-is -- via a ConfirmDialog-adjacent toast,
 * not a field error paragraph. Never throws, mirrors submitAddNode's
 * network-failure handling. */
export async function submitDeleteNode(iri: string): Promise<DeleteOutcome> {
  let status: number;
  let body: ApplyResponseBody;
  try {
    ({ status, body } = await applyOne({ op: "delete_node", iri }));
  } catch {
    return { ok: false, errorMessage: GENERIC_DELETE_ERROR };
  }
  if (status === 201) return { ok: true, errorMessage: null };
  const message = body.violations?.[0]?.message ?? GENERIC_DELETE_ERROR;
  return { ok: false, errorMessage: message };
}
