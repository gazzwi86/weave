import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsPanel } from "../comments-panel";

vi.mock("@/lib/explorer/comments-client", () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

// AC-6: comment thread + composer for a spotlighted node.
describe("CommentsPanel", () => {
  it("renders the author's IRI local part and the comment body", async () => {
    const { listComments } = await import("@/lib/explorer/comments-client");
    vi.mocked(listComments).mockResolvedValue([
      {
        comment_id: "c1",
        target_kind: "node",
        target_ref: "iri:n1",
        author: "https://weave.example/principals/alice",
        body: "worth reviewing",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    render(<CommentsPanel targetKind="node" targetRef="iri:n1" />);

    expect(await screen.findByText("worth reviewing")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("posts a new comment via the composer", async () => {
    const { listComments, createComment } = await import("@/lib/explorer/comments-client");
    vi.mocked(listComments).mockResolvedValue([]);
    vi.mocked(createComment).mockResolvedValue("c2");

    render(<CommentsPanel targetKind="node" targetRef="iri:n1" />);

    const input = await screen.findByLabelText("Add a comment");
    fireEvent.change(input, { target: { value: "nice" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await Promise.resolve();
    await Promise.resolve();

    expect(createComment).toHaveBeenCalledWith("node", "iri:n1", "nice");
  });
});
