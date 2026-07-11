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

  it("test_chat_aside_cant_parse_gives_specific_reply_not_generic_loop", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(422, { message: "I couldn't tell which kind you meant." })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel />);

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "make a thing" } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByText(/I couldn't tell which kind you meant\./);
    expect(screen.getByText(/Try:/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "make another thing" } });
    fireEvent.submit(input.closest("form")!);

    // F-D12: never the exact same generic reply twice in one session --
    // the second occurrence carries the "Still not sure" repeat prefix.
    await screen.findByText(/Still not sure/);
    const replies = screen.getAllByText(/I couldn't tell which kind you meant\./);
    expect(replies).toHaveLength(2);
  });

  it("test_chat_provider_unavailable_table_and_form_stay_live", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(502, {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel />);

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "make a thing" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText(/model provider is unavailable/i);
    // The chat aside's own input stays interactive -- it is an
    // independent component from the browse/search table and guided
    // form beside it, so provider failure never disables them (AC-9).
    expect(input).not.toBeDisabled();
  });
});
