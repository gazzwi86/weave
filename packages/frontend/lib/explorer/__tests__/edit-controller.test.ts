import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDraftHeadForTests, getDraftHead } from "../draft-head";
import {
  buildDeleteOps,
  commitDelete,
  commitOp,
  commitUpdate,
  elementIdsForDeleteOps,
  humaniseViolations,
  type WriteProxyFn,
  type WriteProxyResult,
} from "../edit-controller";
import type { RendererAdapter } from "../renderer-adapter";

const TIMEOUT_MS = 10_000;

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
  return {
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    getNodeData: vi.fn(() => undefined),
    ...overrides,
  } as unknown as RendererAdapter;
}

const ADD_NODE_OP = {
  op: "add_node" as const,
  ref: "local:1",
  kind: "Process",
  label: "New process",
  properties: {},
  additional_types: [],
};
const GHOST_NODE = { data: { id: "local:1", label: "New process", bpmo_kind: "Process" } };

function writeProxyReturning(result: WriteProxyResult): WriteProxyFn {
  return vi.fn(async () => result);
}

// AC-4: 422 SHACL rejection rolls the optimistic node back and hands the
// caller a humanised (not raw-JSON) violation message.
describe("commitOp -- AC-4 422 rollback", () => {
  // removes the optimistic node and calls onShaclViolations with humanised
  // text on 422 -- invariants-explorer.md M2 delta
  it("test_add_node_rollback_on_422", async () => {
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => ({ label: "New process", bpmoKind: "Process" })) });
    const writeProxy = writeProxyReturning({
      status: 422,
      body: { violations: [{ focus_node: "local:1", path: "bpmo:performedBy", severity: "Violation", message: "Process requires performedBy" }] },
    });
    const onShaclViolations = vi.fn();
    const onRetryable = vi.fn();

    await commitOp({ op: ADD_NODE_OP, optimisticElement: GHOST_NODE, adapter, writeProxy, timeoutMs: TIMEOUT_MS, onShaclViolations, onRetryable });

    expect(adapter.removeElements).toHaveBeenCalledWith(["local:1"]);
    expect(onShaclViolations).toHaveBeenCalledWith(["New process: Process requires performedBy"]);
    expect(onRetryable).not.toHaveBeenCalled();
  });

  it("never surfaces the raw focus-node IRI when no label can be resolved", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({
      status: 422,
      body: { violations: [{ focus_node: "urn:node:unresolvable", path: "p", severity: "Violation", message: "required" }] },
    });
    const onShaclViolations = vi.fn();

    await commitOp({ op: ADD_NODE_OP, optimisticElement: GHOST_NODE, adapter, writeProxy, timeoutMs: TIMEOUT_MS, onShaclViolations, onRetryable: vi.fn() });

    const [messages] = onShaclViolations.mock.calls[0] as [string[]];
    expect(messages[0]).not.toContain("urn:node:unresolvable");
  });
});

// AC-5: timeout / 5xx rolls the optimistic element back leaving no orphan
// and offers a retry that re-runs the same op.
describe("commitOp -- AC-5 timeout/error rollback, no orphan", () => {
  it("removes the optimistic node and offers a retry on timeout (status 0)", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 0, body: null });
    const onRetryable = vi.fn();

    await commitOp({ op: ADD_NODE_OP, optimisticElement: GHOST_NODE, adapter, writeProxy, timeoutMs: TIMEOUT_MS, onShaclViolations: vi.fn(), onRetryable });

    expect(adapter.removeElements).toHaveBeenCalledWith(["local:1"]);
    expect(onRetryable).toHaveBeenCalledTimes(1);
  });

  it("retry action re-runs the same op end to end (idempotent retry)", async () => {
    const adapter = fakeAdapter();
    const writeProxy = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, body: null })
      .mockResolvedValueOnce({ status: 201, body: { activity_iri: "urn:a:1", applied_count: 1, version_iri: "urn:v:1", ref_map: { "local:1": "urn:node:real-1" } } });
    let retryFn: (() => Promise<void>) | undefined;

    await commitOp({
      op: ADD_NODE_OP,
      optimisticElement: GHOST_NODE,
      adapter,
      writeProxy,
      timeoutMs: TIMEOUT_MS,
      onShaclViolations: vi.fn(),
      onRetryable: (retry) => {
        retryFn = retry;
      },
    });
    await retryFn?.();

    expect(writeProxy).toHaveBeenCalledTimes(2);
    expect(adapter.reconcileElement).toHaveBeenCalledWith("local:1", { data: { ...GHOST_NODE.data, id: "urn:node:real-1" } });
  });
});

// AC-8: a successful commit reconciles the optimistic ref to the real IRI
// CE-WRITE-1 returned via ref_map.
describe("commitOp -- AC-8 reconcile on 201", () => {
  it("reconciles an add_node's local ref to the real IRI from ref_map", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({
      status: 201,
      body: { activity_iri: "urn:a:1", applied_count: 1, version_iri: "urn:v:1", ref_map: { "local:1": "urn:node:real-1" } },
    });

    await commitOp({ op: ADD_NODE_OP, optimisticElement: GHOST_NODE, adapter, writeProxy, timeoutMs: TIMEOUT_MS, onShaclViolations: vi.fn(), onRetryable: vi.fn() });

    expect(adapter.addLayerNodes).toHaveBeenCalledWith([GHOST_NODE]);
    expect(adapter.reconcileElement).toHaveBeenCalledWith("local:1", { data: { ...GHOST_NODE.data, id: "urn:node:real-1" } });
    expect(adapter.removeElements).not.toHaveBeenCalled();
  });

  it("reconciles an add_edge (no ref_map entry -- id is already the real endpoints) without changing its id", async () => {
    const adapter = fakeAdapter();
    const edgeOp = { op: "add_edge" as const, subject_ref: "urn:node:a", predicate: "urn:pred:x", object_ref: "urn:node:b" };
    const ghostEdge = { data: { id: "urn:node:a|urn:pred:x|urn:node:b", source: "urn:node:a", target: "urn:node:b", label: "urn:pred:x" } };
    const writeProxy = writeProxyReturning({
      status: 201,
      body: { activity_iri: "urn:a:1", applied_count: 1, version_iri: "urn:v:1", ref_map: {} },
    });

    await commitOp({ op: edgeOp, optimisticElement: ghostEdge, adapter, writeProxy, timeoutMs: TIMEOUT_MS, onShaclViolations: vi.fn(), onRetryable: vi.fn() });

    expect(adapter.reconcileElement).toHaveBeenCalledWith(ghostEdge.data.id, ghostEdge);
  });
});

describe("humaniseViolations", () => {
  it("prefixes each violation's message with the focus node's label, not its IRI", () => {
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => ({ label: "Onboarding", bpmoKind: "Process" })) });

    const messages = humaniseViolations(
      [{ focus_node: "urn:node:onboarding", path: "bpmo:performedBy", severity: "Violation", message: "requires performedBy" }],
      adapter
    );

    expect(messages).toEqual(["Onboarding: requires performedBy"]);
  });

  it("falls back to a generic label when the focus node isn't loaded on canvas", () => {
    const adapter = fakeAdapter();

    const messages = humaniseViolations([{ focus_node: "urn:node:unknown", path: "p", severity: "Violation", message: "required" }], adapter);

    expect(messages).toEqual(["This item: required"]);
  });
});

// TASK-024 AC-1: update_node commits via the write proxy and reconciles the
// canvas label -- no ghost element, unlike commitOp's add lifecycle.
describe("commitUpdate", () => {
  beforeEach(() => resetDraftHeadForTests());

  it("bumps the draft head and reconciles the canvas label on 201", async () => {
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => ({ label: "Old label", bpmoKind: "Process" })) });
    const writeProxy = writeProxyReturning({ status: 201, body: { activity_iri: "urn:a:1", applied_count: 1, version_iri: "urn:v:2" } });

    const result = await commitUpdate({
      iri: "urn:node:1",
      properties: { "weave:label": "New label" },
      labelOverride: "New label",
      adapter,
      writeProxy,
      timeoutMs: TIMEOUT_MS,
    });

    expect(result).toEqual({ status: "ok" });
    expect(writeProxy).toHaveBeenCalledWith([{ op: "update_node", iri: "urn:node:1", properties: { "weave:label": "New label" } }], TIMEOUT_MS);
    expect(adapter.reconcileElement).toHaveBeenCalledWith("urn:node:1", { data: { id: "urn:node:1", label: "New label", bpmo_kind: "Process" } });
    expect(getDraftHead()).toBe(1);
  });

  it("returns humanised violations on 422 and does not touch the canvas or the draft head", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({
      status: 422,
      body: { violations: [{ focus_node: "urn:node:1", path: "weave:label", severity: "Violation", message: "too long" }] },
    });

    const result = await commitUpdate({ iri: "urn:node:1", properties: {}, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "violations", messages: ["This item: too long"] });
    expect(adapter.reconcileElement).not.toHaveBeenCalled();
    expect(getDraftHead()).toBe(0);
  });

  it("returns retry on timeout/network failure (status 0)", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 0, body: null });

    const result = await commitUpdate({ iri: "urn:node:1", properties: {}, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "retry" });
  });
});

// TASK-024 AC-5/AC-6/AC-7: delete batch composition + commit.
describe("buildDeleteOps / elementIdsForDeleteOps", () => {
  it("orders edge deletes before the node delete, direction-aware", () => {
    const ops = buildDeleteOps("urn:node:1", [
      { iri: "urn:node:2", label: "B", bpmoKind: "Process", edgePredicate: "weave:next", edgeDirection: "outgoing" },
      { iri: "urn:node:3", label: "C", bpmoKind: "Process", edgePredicate: "weave:prev", edgeDirection: "incoming" },
    ]);

    expect(ops).toEqual([
      { op: "delete_edge", subject: "urn:node:1", predicate: "weave:next", object: "urn:node:2" },
      { op: "delete_edge", subject: "urn:node:3", predicate: "weave:prev", object: "urn:node:1" },
      { op: "delete_node", iri: "urn:node:1" },
    ]);
  });

  it("maps ops to the same |-joined element ids the canvas uses", () => {
    const ops = buildDeleteOps("urn:node:1", [
      { iri: "urn:node:2", label: "B", bpmoKind: "Process", edgePredicate: "weave:next", edgeDirection: "outgoing" },
    ]);

    expect(elementIdsForDeleteOps(ops)).toEqual(["urn:node:1|weave:next|urn:node:2", "urn:node:1"]);
  });
});

describe("commitDelete", () => {
  beforeEach(() => resetDraftHeadForTests());

  it("removes exactly the submitted ops' elements and bumps the draft head on 201 (AC-6)", async () => {
    const adapter = fakeAdapter();
    const ops = buildDeleteOps("urn:node:1", [
      { iri: "urn:node:2", label: "B", bpmoKind: "Process", edgePredicate: "weave:next", edgeDirection: "outgoing" },
    ]);
    const writeProxy = writeProxyReturning({ status: 201, body: { activity_iri: "urn:a:1", applied_count: 2, version_iri: "urn:v:2" } });

    const result = await commitDelete({ ops, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "ok" });
    expect(adapter.removeElements).toHaveBeenCalledWith(["urn:node:1|weave:next|urn:node:2", "urn:node:1"]);
    expect(getDraftHead()).toBe(1);
  });

  // removes nothing from the canvas on failure -- no phantom removal (AC-7)
  // -- invariants-explorer.md M2 delta
  it("test_delete_rollback_on_failure", async () => {
    const adapter = fakeAdapter();
    const ops = buildDeleteOps("urn:node:1", []);
    const writeProxy = writeProxyReturning({ status: 0, body: null });

    const result = await commitDelete({ ops, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "failed" });
    expect(adapter.removeElements).not.toHaveBeenCalled();
    expect(getDraftHead()).toBe(0);
  });

  it("removes nothing from the canvas on a 422 either", async () => {
    const adapter = fakeAdapter();
    const ops = buildDeleteOps("urn:node:1", []);
    const writeProxy = writeProxyReturning({ status: 422, body: { violations: [] } });

    const result = await commitDelete({ ops, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "failed" });
    expect(adapter.removeElements).not.toHaveBeenCalled();
  });

  // Edge case: a foreign-owned/other-tenant node the proxy's tenant-scoped
  // CE lookup can't find -- CE-WRITE-1's surface is only 201/422 (task brief
  // pin), so any other status (404 included) must collapse into the same
  // generic "failed, canvas untouched" branch as a 5xx/timeout, never a
  // silent no-op success.
  it("treats an unexpected 404 (e.g. a foreign-owned/already-deleted node) as a failure, not a silent success", async () => {
    const adapter = fakeAdapter();
    const ops = buildDeleteOps("urn:node:1", []);
    const writeProxy = writeProxyReturning({ status: 404, body: { error: "not_found" } });

    const result = await commitDelete({ ops, adapter, writeProxy, timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ status: "failed" });
    expect(adapter.removeElements).not.toHaveBeenCalled();
    expect(getDraftHead()).toBe(0);
  });
});
