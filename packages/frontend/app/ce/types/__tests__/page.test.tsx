import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CeTypesPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TYPES = {
  kinds: [
    {
      iri: "https://weave.dev/ontology/bpmo#Process",
      label: "Process",
      description: "A repeatable sequence of activities performed to achieve a goal.",
      properties: [
        {
          path: "https://weave.dev/ontology/bpmo#name",
          name: "name",
          is_relationship: false,
          min_count: 1,
          max_count: 1,
          severity: "Violation",
        },
        {
          path: "https://weave.dev/ontology/bpmo#performedBy",
          name: "performed by",
          is_relationship: true,
          min_count: 0,
          max_count: null,
          severity: "Violation",
        },
      ],
    },
    {
      iri: "https://weave.dev/ontology/bpmo#Actor",
      label: "Actor",
      description: null,
      properties: [],
    },
  ],
  relationships: [],
};

const PROCESS_ROW = "kind-row-Process";

const NODE_KINDS = {
  kinds: [{ id: "Process", label: "Process", colour: "var(--color-kind-process)" }],
};

function stubFetch(typesResponse: Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/proxy/node-kinds")
        ? jsonResponse(NODE_KINDS)
        : typesResponse.clone()
    )
  );
}

describe("CeTypesPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the kind catalogue with property summaries", async () => {
    stubFetch(jsonResponse(TYPES));

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Actor")).toBeInTheDocument();
    expect(screen.getByTestId(PROCESS_ROW)).toHaveTextContent(
      "1 property · 1 relationship"
    );
  });

  it("shows the kind's skos:definition description as secondary text under its label (AC-011-04)", async () => {
    stubFetch(jsonResponse(TYPES));

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId(PROCESS_ROW)).toBeInTheDocument());
    expect(screen.getByTestId(PROCESS_ROW)).toHaveTextContent(
      "A repeatable sequence of activities performed to achieve a goal."
    );
  });

  it("renders no secondary description line when description is null (AC-011-05)", async () => {
    stubFetch(jsonResponse(TYPES));

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId("kind-row-Actor")).toBeInTheDocument());
    expect(screen.queryByTestId("kind-row-description-Actor")).not.toBeInTheDocument();
  });

  it("renders no secondary description line for an empty-string description (QA edge case)", async () => {
    // Distinct from the null case above: "" !== null but is still JS-falsy,
    // so `kind.description && (...)` must not render a stray empty node.
    stubFetch(
      jsonResponse({
        kinds: [{ ...TYPES.kinds[0], iri: "https://weave.dev/ontology/bpmo#Empty", description: "" }],
        relationships: [],
      })
    );

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId("kind-row-Empty")).toBeInTheDocument());
    expect(screen.queryByTestId("kind-row-description-Empty")).not.toBeInTheDocument();
  });

  it("renders a very long description in full without truncation (QA edge case)", async () => {
    const longDescription = "A ".repeat(200).trim() + " end-of-description-marker";
    stubFetch(
      jsonResponse({
        kinds: [{ ...TYPES.kinds[0], iri: "https://weave.dev/ontology/bpmo#Long", description: longDescription }],
        relationships: [],
      })
    );

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId("kind-row-Long")).toBeInTheDocument());
    expect(screen.getByTestId("kind-row-description-Long")).toHaveTextContent(
      "end-of-description-marker"
    );
  });

  it("expands an inline view-only detail panel on click", async () => {
    stubFetch(jsonResponse(TYPES));

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId(PROCESS_ROW)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(PROCESS_ROW));

    const detail = screen.getByTestId("kind-detail-Process");
    expect(detail).toHaveTextContent("https://weave.dev/ontology/bpmo#Process");
    expect(detail).toHaveTextContent("name");
    expect(detail).toHaveTextContent("1..1");
    expect(detail).toHaveTextContent("performed by");
    expect(detail).toHaveTextContent("0..*");
    expect(detail).toHaveTextContent("Framework kind — view-only in M1; extensions land later.");

    // Toggling again collapses it.
    fireEvent.click(screen.getByTestId(PROCESS_ROW));
    expect(screen.queryByTestId("kind-detail-Process")).not.toBeInTheDocument();
  });

  it("shows a muted error state when the catalogue fetch fails", async () => {
    stubFetch(jsonResponse({ error: "upstream_unavailable" }, 502));

    render(<CeTypesPage />);

    await waitFor(() => expect(screen.getByTestId("types-error")).toBeInTheDocument());
    expect(screen.queryByTestId("kind-list")).not.toBeInTheDocument();
  });
});
