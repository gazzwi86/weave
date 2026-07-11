import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "../chat-panel";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ChatPanel quick-start + clear-history (TASK-031 AC-8)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends the template text when a quick-start chip is clicked", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { operations: [], message: "not sure" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel quickStartTemplates={["add a Process"]} />);

    fireEvent.click(screen.getByRole("button", { name: "add a Process" }));

    await screen.findByText(/not sure/i);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("clears the conversation when the clear-history action is used", async () => {
    window.localStorage.setItem(
      "weave:ce:chat:v1",
      JSON.stringify([{ id: "1", role: "user", text: "hello" }])
    );
    render(<ChatPanel showClearHistory />);

    await screen.findByText("hello");
    fireEvent.click(screen.getByRole("button", { name: /clear history/i }));

    expect(screen.queryByText("hello")).not.toBeInTheDocument();
  });
});
