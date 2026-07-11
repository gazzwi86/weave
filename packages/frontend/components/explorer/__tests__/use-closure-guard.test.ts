import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useClosureGuard } from "../use-closure-guard";

const CLOSURE = [{ predicate: "https://weave.io/ontology/dependsOn", orientation: "forward" as const }];

describe("useClosureGuard (TASK-028 AC-2)", () => {
  it("starts checking, then ok when CE-READ-1 serves every closure predicate", async () => {
    const fetchTypes = vi.fn(() =>
      Promise.resolve({ type: "ok" as const, relationships: [{ path: "https://weave.io/ontology/dependsOn" }] }),
    );

    const { result } = renderHook(() => useClosureGuard(CLOSURE, fetchTypes));

    expect(result.current.status).toBe("checking");

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.missing).toEqual([]);
    expect(result.current.message).toBeNull();
  });

  it("should disable traversal with named missing predicates when types response lacks one", async () => {
    const fetchTypes = vi.fn(() => Promise.resolve({ type: "ok" as const, relationships: [] }));

    const { result } = renderHook(() => useClosureGuard(CLOSURE, fetchTypes));

    await waitFor(() => expect(result.current.status).toBe("drift"));
    expect(result.current.missing).toEqual(["https://weave.io/ontology/dependsOn"]);
    expect(result.current.message).toBe("Ontology drift: https://weave.io/ontology/dependsOn not served by CE");
  });

  it("degrades to drift (traversal disabled) when the types fetch itself fails -- never a silent pass", async () => {
    const fetchTypes = vi.fn(() => Promise.resolve({ type: "error" as const, status: 503 }));

    const { result } = renderHook(() => useClosureGuard(CLOSURE, fetchTypes));

    await waitFor(() => expect(result.current.status).toBe("drift"));
    expect(result.current.message).toContain("Ontology drift");
  });
});
