import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";

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
      iri: "https://weave.io/ontology/Process",
      label: "Process",
      description: "A repeatable sequence of activities performed to achieve a goal.",
      properties: [
        {
          path: "https://weave.io/ontology/name",
          name: "name",
          is_relationship: false,
          min_count: 1,
          max_count: 1,
          severity: "Violation",
        },
      ],
    },
    {
      iri: "https://weave.io/ontology/Actor",
      label: "Actor",
      description: null,
      properties: [],
    },
  ],
  relationships: [
    {
      path: "https://weave.io/ontology/performedBy",
      name: "performed by",
      is_relationship: true,
      min_count: 0,
      max_count: null,
      severity: "Violation",
    },
  ],
};

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const SPARQL_PAGE = {
  rows: [{ subject: "urn:a", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" }],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

function stubFetch(typesResponse: Response, sparqlResponse: Response = jsonResponse(SPARQL_PAGE)): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("sparql")) return sparqlResponse.clone();
    return typesResponse.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <ToastProvider>
      <CeTypesPage />
    </ToastProvider>
  );
}

describe("CeTypesPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the kind catalogue as a data table", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    expect(screen.getByText("Actor")).toBeInTheDocument();
    expect(screen.getAllByText("Framework").length).toBeGreaterThan(0);
  });

  it("filters to an empty table on the Extensions chip (no extension kinds exist in M1)", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Extensions" }));

    expect(screen.queryByText("Process")).not.toBeInTheDocument();
    expect(screen.getByText("No rows.")).toBeInTheDocument();
  });

  it("shows relationship shapes on the Relationships chip", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));

    expect(screen.getByText("performed by")).toBeInTheDocument();
    expect(screen.queryByText("Process")).not.toBeInTheDocument();
  });

  it("filters rows by the search box", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Search kinds"), { target: { value: "actor" } });

    expect(screen.queryByText("Process")).not.toBeInTheDocument();
    expect(screen.getByText("Actor")).toBeInTheDocument();
  });

  it("opens the edit drawer prefilled and shows a not-available-yet toast on save", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit Process" }));

    const labelInput = await screen.findByLabelText("Label");
    expect(labelInput).toHaveValue("Process");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Kind editing isn't available yet/)).toBeInTheDocument();
  });

  it("opens a blank drawer from New extension kind", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New extension kind" }));

    const labelInput = await screen.findByLabelText("Label");
    expect(labelInput).toHaveValue("");
  });

  it("wires the Instances column from the CE-READ-1 tally (C3)", async () => {
    stubFetch(jsonResponse(TYPES));
    renderPage();

    const processRow = (await screen.findByText("Process")).closest("tr");
    expect(processRow).not.toBeNull();
    await waitFor(() => expect(within(processRow as HTMLElement).getByText("1")).toBeInTheDocument());

    const actorRow = screen.getByText("Actor").closest("tr");
    expect(within(actorRow as HTMLElement).getByText("0")).toBeInTheDocument();
  });

  it("keeps the Instances placeholder when the tally fetch fails", async () => {
    stubFetch(jsonResponse(TYPES), jsonResponse({ error: "down" }, 502));
    renderPage();

    const processRow = (await screen.findByText("Process")).closest("tr");
    expect(within(processRow as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("shows an ErrorCard with retry when the catalogue fetch fails", async () => {
    const fetchMock = stubFetch(jsonResponse({ error: "upstream_unavailable" }, 502));
    renderPage();

    const errorCard = await screen.findByRole("alert");
    expect(within(errorCard).getByText(/Couldn't load the kind catalogue/)).toBeInTheDocument();

    fetchMock.mockImplementation(async () => jsonResponse(TYPES));
    fireEvent.click(within(errorCard).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Process")).toBeInTheDocument());
  });
});
