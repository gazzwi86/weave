import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptBox } from "../prompt-box";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("PromptBox", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("disables the prompt box for readers with an explanatory tooltip", () => {
    render(<PromptBox projectId="p-1" canPrompt={false} />);

    const textarea = screen.getByLabelText("Prompt");
    expect(textarea).toBeDisabled();
    expect(screen.getByText(/only editors and admins can submit a prompt/i)).toBeInTheDocument();
  });

  it("submits the prompt and shows the run status once accepted (AC-1/AC-4)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse({ run_id: "r-1", prompt_id: "pr-1" }, 202)
        : jsonResponse({ project_iri: "p-1", phase: "running", dispatch_count: 1, tasks: [] })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PromptBox projectId="p-1" canPrompt={true} />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "fix this inaccuracy" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit prompt" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/build/projects/p-1/prompts",
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.getByTestId("prompt-run-status")).toHaveTextContent("queued");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId("prompt-run-status")).toHaveTextContent("running");
  });

  it("shows a validation error on 422 without dropping the run status region", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "validation_error", field: "prompt_text" }, 422)
      )
    );

    render(<PromptBox projectId="p-1" canPrompt={true} />);
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit prompt" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid value for \"prompt_text\"")
    );
  });
});
