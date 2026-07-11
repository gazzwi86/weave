import { describe, expect, it, vi } from "vitest";

import { commitOp, humaniseViolations, type WriteProxyFn, type WriteProxyResult } from "../edit-controller";
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

const ADD_NODE_OP = { op: "add_node" as const, ref: "local:1", kind: "Process", label: "New process", properties: {} };
const GHOST_NODE = { data: { id: "local:1", label: "New process", bpmo_kind: "Process" } };

function writeProxyReturning(result: WriteProxyResult): WriteProxyFn {
  return vi.fn(async () => result);
}

// AC-4: 422 SHACL rejection rolls the optimistic node back and hands the
// caller a humanised (not raw-JSON) violation message.
describe("commitOp -- AC-4 422 rollback", () => {
  it("removes the optimistic node and calls onShaclViolations with humanised text on 422", async () => {
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
