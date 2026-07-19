import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import { CanvasAskBar } from "../canvas-ask-bar";

const NL_SUCCESS = {
  sparql_generated: "SELECT ?p WHERE { ?p a weave:Process . }",
  rows: [{ p: "urn:process-1" }],
  column_names: ["p"],
  grounded_iris: ["urn:process-1"],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const adapter = { getNodeData: vi.fn(() => undefined) } as unknown as RendererAdapter;

async function askQuestion(question: string): Promise<void> {
  fireEvent.change(screen.getByRole("textbox", { name: "Ask a question" }), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe("CanvasAskBar", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts the ask bar on the canvas with the mock's placeholder copy", () => {
    render(<CanvasAskBar adapter={adapter} />);
    expect(screen.getByPlaceholderText("Ask the model — what depends on Orders DB?")).toBeInTheDocument();
  });

  it("submits the question to the same /api/query/nl endpoint the /ce/query page uses", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    vi.stubGlobal("fetch", fetchSpy);
    render(<CanvasAskBar adapter={adapter} />);

    await askQuestion("what depends on Orders DB?");

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/api/query/nl", expect.objectContaining({ method: "POST" }))
    );
  });

  it("shows a grounded feedback sentence once the answer succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(200, NL_SUCCESS))));
    render(<CanvasAskBar adapter={adapter} />);

    await askQuestion("what depends on Orders DB?");
    await waitFor(() => expect(screen.getByText(/1 result/i)).toBeInTheDocument());
  });

  it("shows the lifecycle's error message when the ask fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(400, { error: "translation_failed" }))));
    render(<CanvasAskBar adapter={adapter} />);

    await askQuestion("gibberish");
    await waitFor(() => expect(screen.getByText(/rephrasing/i)).toBeInTheDocument());
  });

  // G19: the positioning wrapper has no background of its own -- its
  // horizontal padding (beyond the pill) and the transparent canvas above
  // it are real canvas, but the wrapper <div> still sits over them. It
  // opts out of pointer events; only the actual ask-bar pill opts back in.
  it("lets clicks in the wrapper's padding pass through to the canvas (G19)", () => {
    const { container } = render(<CanvasAskBar adapter={adapter} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("pointer-events-none");

    const askBarForm = screen.getByRole("textbox", { name: "Ask a question" }).closest("form") as HTMLElement;
    expect(askBarForm).toHaveClass("pointer-events-auto");
  });
});
