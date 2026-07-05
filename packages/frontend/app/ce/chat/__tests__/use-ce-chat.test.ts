import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCeChat } from "../use-ce-chat";

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init))
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("useCeChat", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-006-02/AC-006-12: NL parse proposes a batch with an accompanying
  // plain-language explanation, and does not dispatch until confirmed.
  it("proposes an operation batch with an explanation, without dispatching", async () => {
    stubFetch((url) => {
      if (url.includes("/api/ontology/authoring/nl")) {
        return jsonResponse(200, {
          operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "Customer Onboarding" }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { result } = renderHook(() => useCeChat());

    await act(async () => {
      await result.current.sendMessage("Add a Process called Customer Onboarding");
    });

    expect(result.current.pendingOperations).toHaveLength(1);
    const proposal = result.current.messages.at(-1);
    expect(proposal?.text).toContain("Customer Onboarding");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  // AC-006-06: an ambiguous prompt (backend 422) asks a clarifying question
  // rather than guessing.
  it.each([
    ["make it better", "nl_parse_failed"],
    ["do the thing", "nl_parse_failed"],
    ["update it", "nl_parse_failed"],
  ])("asks a clarifying question for a vague prompt: %s", async (prompt) => {
    stubFetch(() => jsonResponse(422, { error: "nl_parse_failed", message: "Which entity do you mean?" }));
    const { result } = renderHook(() => useCeChat());

    await act(async () => {
      await result.current.sendMessage(prompt);
    });

    expect(result.current.pendingOperations).toBeNull();
    expect(result.current.messages.at(-1)?.text).toContain("Which entity do you mean?");
  });

  // AC-006-03: confirm dispatches to CE-WRITE-1 and shows the committed IRI.
  it("dispatches to CE-WRITE-1 on confirm and shows the committed IRI", async () => {
    stubFetch((url) => {
      if (url.includes("/api/ontology/authoring/nl")) {
        return jsonResponse(200, {
          operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "Customer Onboarding" }],
        });
      }
      if (url.includes("/api/operations/apply")) {
        return jsonResponse(201, {
          activity_iri: "urn:weave:activity:a1",
          applied_count: 1,
          version_iri: "urn:weave:version:v1",
          ref_map: { p1: "urn:weave:process:p1" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { result } = renderHook(() => useCeChat());
    await act(async () => {
      await result.current.sendMessage("Add a Process called Customer Onboarding");
    });

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.pendingOperations).toBeNull();
    expect(result.current.messages.at(-1)?.text).toContain("urn:weave:process:p1");
    expect(result.current.messages.at(-1)?.resultIri).toBe("urn:weave:process:p1");
  });

  // AC-006-03: a 422 SHACL violation on confirm surfaces in the chat thread.
  it("shows a SHACL violation message when confirm returns 422", async () => {
    stubFetch((url) => {
      if (url.includes("/api/ontology/authoring/nl")) {
        return jsonResponse(200, {
          operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "X" }],
        });
      }
      return jsonResponse(422, {
        violations: [{ focus_node: "urn:a", path: null, severity: "Violation", message: "owner is required" }],
      });
    });
    const { result } = renderHook(() => useCeChat());
    await act(async () => {
      await result.current.sendMessage("Add a Process called X");
    });

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.messages.at(-1)?.text).toContain("owner is required");
  });

  it("clears the pending proposal on reject without dispatching", async () => {
    stubFetch(() =>
      jsonResponse(200, {
        operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "X" }],
      })
    );
    const { result } = renderHook(() => useCeChat());
    await act(async () => {
      await result.current.sendMessage("Add a Process called X");
    });

    act(() => {
      result.current.reject();
    });

    expect(result.current.pendingOperations).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  // AC-006-04 (E2E path): "undo" re-proposes the inverse batch of the most
  // recent confirmed mutation for confirmation, then confirming it applies.
  it("proposes and applies the inverse batch on undo", async () => {
    let applyCalls = 0;
    stubFetch((url) => {
      if (url.includes("/api/ontology/authoring/nl")) {
        return jsonResponse(200, {
          operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "X" }],
        });
      }
      if (url.includes("/api/operations/apply")) {
        applyCalls += 1;
        if (applyCalls === 1) {
          return jsonResponse(201, {
            activity_iri: "urn:a",
            applied_count: 1,
            version_iri: "urn:v1",
            ref_map: { p1: "urn:weave:process:p1" },
          });
        }
        return jsonResponse(201, { activity_iri: "urn:a2", applied_count: 1, version_iri: "urn:v2", ref_map: {} });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { result } = renderHook(() => useCeChat());
    await act(async () => {
      await result.current.sendMessage("Add a Process called X");
    });
    await act(async () => {
      await result.current.confirm();
    });

    await act(async () => {
      await result.current.sendMessage("undo");
    });

    expect(result.current.pendingOperations).toEqual([{ op: "delete_node", iri: "urn:weave:process:p1" }]);

    await act(async () => {
      await result.current.confirm();
    });

    expect(applyCalls).toBe(2);
    expect(result.current.pendingOperations).toBeNull();
  });

  // AC-006-05: conversation history survives a page reload.
  it("persists conversation history to localStorage across hook instances", async () => {
    stubFetch(() =>
      jsonResponse(200, { operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "X" }] })
    );
    const first = renderHook(() => useCeChat());
    await act(async () => {
      await first.result.current.sendMessage("Add a Process called X");
    });

    const second = renderHook(() => useCeChat());

    await waitFor(() => {
      expect(second.result.current.messages).toHaveLength(first.result.current.messages.length);
    });
    expect(second.result.current.messages.map((m) => m.text)).toEqual(
      first.result.current.messages.map((m) => m.text)
    );
  });
});
