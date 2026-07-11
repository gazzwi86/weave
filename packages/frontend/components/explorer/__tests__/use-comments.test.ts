import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useComments } from "../use-comments";

// AC-6: "should render comments for node and view targets from service"
describe("useComments", () => {
  it("loads comments for the given target on mount", async () => {
    const listComments = vi.fn().mockResolvedValue([
      { comment_id: "c1", target_kind: "node", target_ref: "iri:n1", author: "iri:u1", body: "hi", created_at: "2026-01-01" },
    ]);
    const { result } = renderHook(() =>
      useComments({ targetKind: "node", targetRef: "iri:n1", listComments, createComment: vi.fn() })
    );

    await act(async () => {});

    expect(listComments).toHaveBeenCalledWith("node", "iri:n1");
    expect(result.current.comments).toHaveLength(1);
  });

  it("submits the draft and refreshes the list, clearing the draft on success", async () => {
    const listComments = vi.fn().mockResolvedValue([]);
    const createComment = vi.fn().mockResolvedValue("c2");
    const { result } = renderHook(() =>
      useComments({ targetKind: "view", targetRef: "v1", listComments, createComment })
    );
    await act(async () => {});

    act(() => result.current.setDraft("nice view"));
    await act(async () => {
      await result.current.submit();
    });

    expect(createComment).toHaveBeenCalledWith("view", "v1", "nice view");
    expect(result.current.draft).toBe("");
    expect(listComments).toHaveBeenCalledTimes(2);
  });

  it("does not submit an empty draft", async () => {
    const createComment = vi.fn();
    const { result } = renderHook(() =>
      useComments({ targetKind: "node", targetRef: "iri:n1", listComments: vi.fn().mockResolvedValue([]), createComment })
    );
    // ponytail: act() hangs here (React's flush loop never settles when
    // nothing schedules a state update) -- plain microtask flushes instead.
    await Promise.resolve();
    await Promise.resolve();
    await result.current.submit();

    expect(createComment).not.toHaveBeenCalled();
  });
});
