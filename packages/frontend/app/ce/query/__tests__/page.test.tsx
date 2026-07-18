import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExplorerCanvas } from "@/components/explorer/use-explorer-canvas";
import QueryPage from "../page";

vi.mock("@/components/explorer/use-explorer-canvas", () => ({ useExplorerCanvas: vi.fn() }));
vi.mocked(useExplorerCanvas).mockReturnValue({
  loadState: "ready",
  errorMessage: null,
  minimapIndicator: null,
  minimapNodes: [],
  containerRef: { current: null },
  retry: vi.fn(),
  totalElements: null,
  adapter: { highlightNodes: vi.fn(), resetOpacity: vi.fn() } as never,
});

const NL_SUCCESS = {
  sparql_generated: "SELECT ?p WHERE { ?p a weave:Process . }",
  rows: [{ p: "urn:process-1" }],
  column_names: ["p"],
  grounded_iris: ["urn:process-1"],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubVersionsFetch(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/proxy/ontology/versions")) {
      return Promise.resolve(jsonResponse(200, { versions: [] }));
    }
    return fetchImpl(input, init);
  }));
}

const EXAMPLE_QUESTION_TEXT = "Who owns Billing?";

async function askQuestion(question: string): Promise<void> {
  fireEvent.change(screen.getByRole("textbox", { name: "Ask a question" }), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe("QueryPage ask lifecycle", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // Refit (mock #sub-query): page eyebrow/title/sub-header, matching the
  // Instances page's PageEyebrowHeader pattern.
  it("renders the Constitution / Query page header", () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    render(<QueryPage />);
    expect(screen.getByText("Constitution")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Query" })).toBeInTheDocument();
    expect(
      screen.getByText("Ask in plain language — Weave grounds the answer in the model and shows its SPARQL working.")
    ).toBeInTheDocument();
  });

  // AC-1: submitting -> success, never dead air.
  it("test_ask_lifecycle_submitting_to_success_never_dead_air", async () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    render(<QueryPage />);

    await askQuestion("What processes exist?");
    expect(screen.getByTestId("ask-submitting")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("result-frame")).toBeInTheDocument());
    expect(screen.queryByTestId("ask-submitting")).not.toBeInTheDocument();
  });

  // Refit (mock #sub-query "Answer" card): the grounded-in caption uses the
  // real client-known version, unlike "answered in Xs" or the NL summary
  // sentence -- neither has a backing API field (see PR gap notes).
  it("shows a grounded-in-version caption alongside the answer on success", async () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    render(<QueryPage />);

    await askQuestion("What processes exist?");
    await waitFor(() => expect(screen.getByTestId("result-frame")).toBeInTheDocument());
    expect(screen.getByText(/grounded in latest/i)).toBeInTheDocument();
  });

  // AC-2: 503 -> provider-missing, with examples, editor stays live.
  it("test_provider_missing_state_shows_examples_editor_stays_live", async () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(503, { error: "provider_unavailable" })));
    render(<QueryPage />);

    await askQuestion("What processes exist?");
    await waitFor(() => expect(screen.getByTestId("ask-provider-missing")).toBeInTheDocument());
    expect(screen.getByText(EXAMPLE_QUESTION_TEXT)).toBeInTheDocument();
    expect(screen.getByLabelText("SPARQL query")).toBeEnabled();
  });

  // AC-3: timeout distinct from generic error.
  it("test_timeout_state_distinct_from_generic_error", async () => {
    stubVersionsFetch(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException("aborted", "AbortError")), 5);
        })
    );
    render(<QueryPage timeoutMs={1} />);

    await askQuestion("What processes exist?");
    await waitFor(() => expect(screen.getByTestId("ask-timeout")).toBeInTheDocument());
    expect(screen.queryByTestId("ask-error")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  // R2: a long wait must show live progress, not a frozen "Asking..." line.
  it("test_submitting_state_ticks_elapsed_seconds_not_a_frozen_spinner", async () => {
    vi.useFakeTimers();
    stubVersionsFetch(() => new Promise(() => undefined));
    render(<QueryPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "Ask a question" }), {
      target: { value: "What processes exist?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("ask-submitting")).toHaveTextContent("Generating… (0s)");
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByTestId("ask-submitting")).toHaveTextContent("Generating… (3s)");
    vi.useRealTimers();
  });

  // AC-4: non-timeout failure names what went wrong, with examples.
  it("test_error_state_names_failure_with_examples", async () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(400, { error: "translation_failed" })));
    render(<QueryPage />);

    await askQuestion("gibberish");
    await waitFor(() => expect(screen.getByTestId("ask-error")).toBeInTheDocument());
    expect(screen.getByTestId("ask-error").closest("div")).toHaveTextContent(/rephrasing/i);
    expect(screen.getByText(EXAMPLE_QUESTION_TEXT)).toBeInTheDocument();
  });

  // AC-8: labelled version selector, defaults to latest.
  it("test_version_selector_labelled_and_defaults_latest", () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    render(<QueryPage />);
    const select = screen.getAllByLabelText("Version")[0] as HTMLSelectElement;
    expect(select.value).toBe("latest");
  });

  // Refit (mock #sub-query .sparql-card .error-card): a failed hand-typed
  // run surfaces via the shared ErrorCard, not a bare <p role="alert">.
  it("shows a failed SPARQL run via the shared ErrorCard", async () => {
    stubVersionsFetch((input) => {
      const url = String(input);
      if (url.includes("/api/sparql")) {
        return Promise.resolve(jsonResponse(400, { error: "malformed_query" }));
      }
      return Promise.resolve(jsonResponse(200, NL_SUCCESS));
    });
    render(<QueryPage />);

    fireEvent.change(screen.getByLabelText("SPARQL query"), { target: { value: "SELECT * WHERE { ?s ?p ?o }" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(screen.getByTestId("editor-error")).toBeInTheDocument());
    expect(screen.getByTestId("editor-error")).toBe(screen.getByRole("alert"));
    expect(screen.getByTestId("editor-error")).toHaveTextContent("malformed_query");
  });

  // AC-9: Run is the sole primary action; Explain + coverage report are secondary.
  it("test_sparql_editor_run_is_sole_primary_action_others_secondary", () => {
    stubVersionsFetch(() => Promise.resolve(jsonResponse(200, NL_SUCCESS)));
    render(<QueryPage />);
    const run = screen.getByRole("button", { name: "Run" });
    const explain = screen.getByRole("button", { name: "Explain this query" });
    const coverage = screen.getByRole("button", { name: "Run coverage gap report" });
    // secondary variant is the only one with a visible border (button.tsx cva)
    expect(run.className).not.toContain("border");
    expect(explain.className).toContain("border");
    expect(coverage.className).toContain("border");
  });
});
