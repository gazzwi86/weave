import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEntitySearch } from "../use-entity-search";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}

// Fake timers don't fake the microtask queue -- a fetch().then().catch()
// chain needs a few real ticks to fully settle after a timer fires.
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("useEntitySearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // PR #13 finding (2): every keystroke past MIN_QUERY_LENGTH used to fire
  // its own fetch -- one settled search should fire exactly one.
  it("debounces rapid typing into a single fetch for the settled query", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(({ query }) => useEntitySearch(query), {
      initialProps: { query: "a" },
    });
    rerender({ query: "ac" });
    rerender({ query: "acm" });
    rerender({ query: "acme" });

    await vi.advanceTimersByTimeAsync(250);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("q=acme"),
      expect.anything()
    );
  });

  // PR #13 finding (3): a stale request's response (or its own abort) must
  // never blank or overwrite results a fresher, still-in-flight request set.
  it("ignores a stale response that resolves after a newer query's response", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ query }) => useEntitySearch(query), {
      initialProps: { query: "ac" },
    });
    await vi.advanceTimersByTimeAsync(250); // request A fires

    rerender({ query: "acme" }); // aborts A, schedules B
    await vi.advanceTimersByTimeAsync(250); // request B fires

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [resolveA, resolveB] = resolvers;
    if (!resolveA || !resolveB) {
      throw new Error("expected both requests to have registered a resolver");
    }

    resolveB(jsonResponse({ results: [{ iri: "b", label: "B", kind: "" }], total: 1 }));
    await flushMicrotasks();
    // Stale A resolves late, with different data -- must not win.
    resolveA(jsonResponse({ results: [{ iri: "a-stale", label: "STALE", kind: "" }], total: 1 }));
    await flushMicrotasks();

    expect(result.current.results).toEqual([{ iri: "b", label: "B", kind: "" }]);
  });

  // PR #13 finding (3): `.catch` used to fire identically for a real network
  // error and for the AbortError raised when a newer query supersedes this
  // one -- only the former should surface as an error.
  it("does not surface an error when a request is superseded, only on a real failure", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ query }) => useEntitySearch(query), {
      initialProps: { query: "ac" },
    });
    await vi.advanceTimersByTimeAsync(250); // request fires, never resolves

    rerender({ query: "" }); // clears query, aborts the in-flight request
    await flushMicrotasks();

    expect(result.current.error).toBe(false);
  });

  it("surfaces an error on a real fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const { result } = renderHook(({ query }) => useEntitySearch(query), {
      initialProps: { query: "acme" },
    });
    await vi.advanceTimersByTimeAsync(250);
    await flushMicrotasks();

    expect(result.current.error).toBe(true);
    expect(result.current.results).toEqual([]);
  });
});
