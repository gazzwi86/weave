import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BuildPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ACCEPTED = {
  request_id: "req-1",
  status: "drafting",
  stream_url: "/api/requests/req-1/stream",
};

function fillAndSubmit(): void {
  fireEvent.change(screen.getByLabelText("What should Weave build?"), {
    target: { value: "an expense tracker" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Request application" }));
}

describe("BuildPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("posts the prompt and run mode, then shows the drafting status", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(ACCEPTED, 202)
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<BuildPage />);
    fireEvent.change(screen.getByLabelText("What should Weave build?"), {
      target: { value: "an expense tracker" },
    });
    fireEvent.change(screen.getByLabelText("Run mode"), {
      target: { value: "spec_to_build" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request application" }));

    await waitFor(() =>
      expect(screen.getByTestId("request-status")).toHaveTextContent("drafting")
    );
    expect(screen.getByText("Request req-1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/requests",
      expect.objectContaining({ method: "POST" })
    );
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(init?.body as string) as unknown;
    expect(body).toEqual({ prompt: "an expense tracker", run_mode: "spec_to_build" });
  });

  it("polls every 2s until a terminal status and renders draft_content", async () => {
    vi.useFakeTimers();
    const terminal = {
      request_id: "req-1",
      status: "spec_ready",
      run_mode: "draft_spec_only",
      graph_context: {},
      draft_content: { title: "Expense tracker draft spec" },
      created_at: "2026-07-08T00:00:00Z",
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? jsonResponse(ACCEPTED, 202) : jsonResponse(terminal)
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<BuildPage />);
    fillAndSubmit();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("request-status")).toHaveTextContent("drafting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId("request-status")).toHaveTextContent("spec_ready");
    expect(screen.getByTestId("draft-content")).toHaveTextContent(
      "Expense tracker draft spec"
    );

    // Terminal status stops the poll -- no further GETs after more time passes.
    const callsAtTerminal = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(fetchMock.mock.calls).toHaveLength(callsAtTerminal);
  });

  it("shows the provider-unavailable message on 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: { error: "model_unavailable" } }, 503))
    );

    render(<BuildPage />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The model provider is unavailable — try again shortly."
      )
    );
  });

  it("names the failing field on 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ detail: { error: "validation_error", field: "prompt" } }, 422)
      )
    );

    render(<BuildPage />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent('"prompt"'));
  });
});
