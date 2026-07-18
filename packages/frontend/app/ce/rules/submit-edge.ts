interface ApplyResponseBody {
  violations?: { path: string | null; message: string }[];
}

export interface AddEdgeOutcome {
  ok: boolean;
  errorMessage: string | null;
}

const GENERIC_ATTACH_ERROR = "Could not attach. Please try again.";

/** Policies pane's attach-to-entity flow (R2a-4): dispatches a single
 * `add_edge` op straight to CE-WRITE-1 -- both `subject`/`object` are
 * already-committed IRIs (never in-batch refs), which `_resolve_ref`
 * (operations/graph_ops.py) falls back to using verbatim when it isn't a
 * ref-map key. Never throws, same network-failure posture as
 * `brand/submit-op.ts`'s `submitDeleteNode`.
 */
export async function submitAddEdge(subjectIri: string, predicate: string, objectIri: string): Promise<AddEdgeOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/operations/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operations: [{ op: "add_edge", subject_ref: subjectIri, predicate, object_ref: objectIri }],
      }),
    });
  } catch {
    return { ok: false, errorMessage: GENERIC_ATTACH_ERROR };
  }
  if (res.status === 201) return { ok: true, errorMessage: null };
  const body = (await res.json().catch(() => ({}))) as ApplyResponseBody;
  return { ok: false, errorMessage: body.violations?.[0]?.message ?? GENERIC_ATTACH_ERROR };
}
