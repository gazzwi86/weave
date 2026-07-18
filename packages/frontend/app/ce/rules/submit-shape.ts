const GENERIC_PREVIEW_ERROR = "Could not draft a rule from that text. Try rephrasing it.";
const GENERIC_COMMIT_ERROR = "Could not commit the rule. Please try again.";
const GENERIC_RETIRE_ERROR = "Could not retire the rule. Please try again.";

interface ErrorBody {
  error?: string;
  message?: string;
}

function errorMessage(body: ErrorBody, fallback: string): string {
  return body.message ?? body.error ?? fallback;
}

export interface PreviewOutcome {
  shapeTurtle: string | null;
  errorMessage: string | null;
}

/** New-rule drawer's preview step (G3, remediation-2-api-gaps.md) --
 * proxies to `POST /api/ontology/authoring/nl/shapes/preview`, which never
 * commits (see route.ts). A 422 (`shape_generation_failed`) or 503
 * (`model_provider_unavailable`) both resolve here rather than throw, so
 * the drawer can show the message inline next to the NL box.
 */
export async function submitPreviewShape(text: string): Promise<PreviewOutcome> {
  const res = await fetch("/api/ontology/authoring/nl/shapes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = (await res.json()) as { shape_turtle?: string } & ErrorBody;
  if (res.ok) return { shapeTurtle: body.shape_turtle ?? null, errorMessage: null };
  return { shapeTurtle: null, errorMessage: errorMessage(body, GENERIC_PREVIEW_ERROR) };
}

export interface CommitOutcome {
  shapeIri: string | null;
  errorMessage: string | null;
}

/** Commit step: re-validates `shape_turtle` server-side regardless of
 * origin (preview-drafted or hand-edited) -- see commit/route.ts.
 */
export async function submitCommitShape(shapeTurtle: string, aiGenerated: boolean): Promise<CommitOutcome> {
  const res = await fetch("/api/ontology/authoring/nl/shapes/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shape_turtle: shapeTurtle, ai_generated: aiGenerated }),
  });
  const body = (await res.json()) as { shape_iri?: string } & ErrorBody;
  if (res.ok) return { shapeIri: body.shape_iri ?? null, errorMessage: null };
  return { shapeIri: null, errorMessage: errorMessage(body, GENERIC_COMMIT_ERROR) };
}

export interface RetireOutcome {
  ok: boolean;
  errorMessage: string | null;
}

/** Retire flow -- `DELETE /api/ontology/authoring/shapes?shape_iri=...`.
 * A 403 (`framework_shape_immutable`) means the caller offered retire on a
 * framework shape, which the UI is expected to gate on `origin === "tenant"`
 * (see shapes/route.ts's docstring).
 */
export async function submitRetireShape(shapeIri: string): Promise<RetireOutcome> {
  const res = await fetch(`/api/ontology/authoring/shapes?shape_iri=${encodeURIComponent(shapeIri)}`, {
    method: "DELETE",
  });
  if (res.status === 204) return { ok: true, errorMessage: null };
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  return { ok: false, errorMessage: errorMessage(body, GENERIC_RETIRE_ERROR) };
}
