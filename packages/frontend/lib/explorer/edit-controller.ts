import { bumpDraftHead } from "./draft-head";
import type { NeighbourProps } from "./fetch-node-props";
import type { Op } from "./operations-schema";
import type { CytoscapeElement } from "./types";
import type { RendererAdapter } from "./renderer-adapter";

export interface ShaclViolation {
  focus_node: string;
  path: string | null;
  severity: string;
  message: string;
}

/** Shape of CE-WRITE-1's response, passed through the write proxy
 * unchanged (contracts.md CE-WRITE-1 / `weave_backend.schemas.operations`).
 * `status: 0` is this module's own sentinel for "no HTTP response at all"
 * (network error / `AbortSignal.timeout` fired) -- the write proxy never
 * returns 0 itself. */
export interface WriteProxyResult {
  status: number;
  body: unknown;
}

export type WriteProxyFn = (operations: Op[], timeoutMs: number) => Promise<WriteProxyResult>;

/** CE-WRITE-1's default 201 body (activity_iri/applied_count/version_iri +
 * ref_map local-ref -> real-IRI resolution) and 422 body (violations) --
 * narrowed from `unknown` at the two call sites that need each shape. */
interface ApplySuccessBody {
  ref_map?: Record<string, string>;
}
interface ApplyViolationsBody {
  violations?: ShaclViolation[];
}

/** Default `WriteProxyFn`: posts to this task's own write proxy
 * (`/api/proxy/operations/apply`), aborting after `timeoutMs` (M1's
 * `AbortSignal.timeout` pattern). Network failure and abort both collapse
 * to the `status: 0` sentinel -- `commitOp`'s generic error branch handles
 * both identically (AC-5). */
export async function postToWriteProxy(operations: Op[], timeoutMs: number): Promise<WriteProxyResult> {
  try {
    const response = await fetch("/api/proxy/operations/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}

/** AC-4/implementation hint: renders each violation's `message` prefixed
 * with the focus node's *label* (looked up on canvas) -- never its raw
 * IRI, matching the M1 IRI-hiding rule extended to error surfaces. */
export function humaniseViolations(violations: ShaclViolation[], adapter: RendererAdapter): string[] {
  return violations.map((violation) => {
    const label = adapter.getNodeData(violation.focus_node)?.label ?? "This item";
    return `${label}: ${violation.message}`;
  });
}

// AC-8: an `add_node`'s optimistic id is the local `ref` -- CE-WRITE-1
// resolves it to a real IRI via `ref_map` (dedup: an existing node's IRI
// comes back identically). Every other op's optimistic element already
// carries its final id (an edge's id is its already-real source/predicate/
// target), so reconciliation there only clears the pending visual state.
function resolveAppliedElement(op: Op, optimisticElement: CytoscapeElement, refMap: Record<string, string>): CytoscapeElement {
  if (op.op !== "add_node") return optimisticElement;
  const realId = refMap[op.ref] ?? optimisticElement.data.id;
  return { ...optimisticElement, data: { ...optimisticElement.data, id: realId } };
}

export interface CommitOpOptions {
  op: Op;
  /** The ghost element rendered optimistically -- its `data.id` is the
   * value `adapter.removeElements`/`reconcileElement` roll back or forward
   * from (AC-3/AC-6's local ref or deterministic edge id). */
  optimisticElement: CytoscapeElement;
  adapter: RendererAdapter;
  /** Test seam -- defaults are wired by the caller (quick-add / draw-edge
   * hooks), not here, so this module stays framework/fetch-free at rest. */
  writeProxy: WriteProxyFn;
  timeoutMs: number;
  onShaclViolations: (messages: string[]) => void;
  /** AC-5: called with a retry closure that re-runs this exact commit --
   * idempotency is CE-side (the op's `ref` is stable across retries). */
  onRetryable: (retry: () => Promise<void>) => void;
}

/** TASK-023: single owner of the optimistic edit lifecycle (AC-3/AC-4/
 * AC-5/AC-6/AC-8) -- add the ghost, commit through the write proxy, then
 * reconcile (201), roll back with humanised violations (422), or roll back
 * with a retry offer (anything else, incl. timeout). Reused unchanged by
 * quick-add (AC-3) and draw-edge (AC-6); TASK-024/029 reuse it for
 * update/delete and GE-CANVAS-1 write-back. */
export async function commitOp(options: CommitOpOptions): Promise<void> {
  const { op, optimisticElement, adapter, writeProxy, timeoutMs, onShaclViolations, onRetryable } = options;
  const localId = optimisticElement.data.id;

  adapter.addLayerNodes([optimisticElement]);
  const response = await writeProxy([op], timeoutMs);

  if (response.status === 201) {
    bumpDraftHead(); // TASK-024 AC-2/AC-3: any successful write advances the drift counter.
    const refMap = (response.body as ApplySuccessBody | null)?.ref_map ?? {};
    adapter.reconcileElement(localId, resolveAppliedElement(op, optimisticElement, refMap));
    return;
  }

  adapter.removeElements([localId]);

  if (response.status === 422) {
    const violations = (response.body as ApplyViolationsBody | null)?.violations ?? [];
    onShaclViolations(humaniseViolations(violations, adapter));
    return;
  }

  onRetryable(() => commitOp(options));
}

export interface CommitUpdateOptions {
  iri: string;
  properties: Record<string, unknown>;
  /** New canvas label, if the edited fields include the node's label --
   * undefined leaves the canvas element's label untouched. */
  labelOverride?: string;
  adapter: RendererAdapter;
  writeProxy: WriteProxyFn;
  timeoutMs: number;
}

export type CommitUpdateResult = { status: "ok" } | { status: "violations"; messages: string[] } | { status: "retry" };

/** TASK-024 AC-1/AC-4: commits an `update_node` op via the write proxy.
 * Unlike `commitOp`'s add lifecycle there is no optimistic ghost element --
 * the node already exists on canvas, so a 201 just reconciles its label. */
export async function commitUpdate(options: CommitUpdateOptions): Promise<CommitUpdateResult> {
  const { iri, properties, labelOverride, adapter, writeProxy, timeoutMs } = options;
  const response = await writeProxy([{ op: "update_node", iri, properties }], timeoutMs);

  if (response.status === 201) {
    bumpDraftHead();
    if (labelOverride !== undefined) {
      const existing = adapter.getNodeData(iri);
      adapter.reconcileElement(iri, { data: { id: iri, label: labelOverride, bpmo_kind: existing?.bpmoKind } });
    }
    return { status: "ok" };
  }

  if (response.status === 422) {
    const violations = (response.body as ApplyViolationsBody | null)?.violations ?? [];
    return { status: "violations", messages: humaniseViolations(violations, adapter) };
  }

  return { status: "retry" };
}

/** TASK-024 AC-5/AC-6: one batch -- every incident edge (both directions,
 * `fetchNodeProps`'s full `neighbours` set) deleted before the node itself,
 * so referential integrity holds mid-batch. */
export function buildDeleteOps(nodeId: string, neighbours: NeighbourProps[]): Op[] {
  const edgeOps: Op[] = neighbours.map((neighbour) =>
    neighbour.edgeDirection === "outgoing"
      ? { op: "delete_edge", subject: nodeId, predicate: neighbour.edgePredicate, object: neighbour.iri }
      : { op: "delete_edge", subject: neighbour.iri, predicate: neighbour.edgePredicate, object: nodeId }
  );
  return [...edgeOps, { op: "delete_node", iri: nodeId }];
}

/** Mirrors map-rows-to-elements.ts's `${subject}|${predicate}|${object}`
 * edge-id convention, so canvas removal targets the exact elements the
 * submitted ops represent -- nothing inferred (AC-6). */
function elementIdForDeleteOp(op: Op): string {
  if (op.op === "delete_edge") return `${op.subject}|${op.predicate}|${op.object}`;
  if (op.op === "delete_node") return op.iri;
  throw new Error(`elementIdForDeleteOp: unexpected op "${op.op}" in a delete batch`);
}

export function elementIdsForDeleteOps(ops: Op[]): string[] {
  return ops.map(elementIdForDeleteOp);
}

export interface CommitDeleteOptions {
  ops: Op[];
  adapter: RendererAdapter;
  writeProxy: WriteProxyFn;
  timeoutMs: number;
}

export type CommitDeleteResult = { status: "ok" } | { status: "failed" };

/** TASK-024 AC-6/AC-7: submits the delete batch; canvas elements are only
 * ever removed on 201 -- any other outcome (422/timeout/5xx) leaves the
 * canvas untouched (no phantom removal). */
export async function commitDelete(options: CommitDeleteOptions): Promise<CommitDeleteResult> {
  const { ops, adapter, writeProxy, timeoutMs } = options;
  const response = await writeProxy(ops, timeoutMs);

  if (response.status === 201) {
    bumpDraftHead();
    adapter.removeElements(elementIdsForDeleteOps(ops));
    return { status: "ok" };
  }

  return { status: "failed" };
}
