import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InstancesPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const KINDS = {
  kinds: [
    {
      iri: "https://weave.io/ontology/Process",
      label: "Process",
      properties: [
        { path: "performedBy", name: "Performed by", is_relationship: true, min_count: 0, max_count: 1, severity: "Violation" },
      ],
    },
    { iri: "https://weave.io/ontology/Actor", label: "Actor", properties: [] },
  ],
};

const BROWSE_ROWS = {
  results: {
    bindings: [
      { iri: { value: "urn:p1" }, label: { value: "Invoice Approval" }, kind: { value: "https://weave.io/ontology/Process" } },
      { iri: { value: "urn:a1" }, label: { value: "Finance Team" }, kind: { value: "https://weave.io/ontology/Actor" } },
    ],
  },
};

const RESOURCE = {
  iri: "urn:p1",
  kind: "https://weave.io/ontology/Process",
  label: "Invoice Approval",
  triples: [{ subject: "urn:p1", predicate: "https://weave.io/ontology/label", object: "Invoice Approval" }],
  outgoing: [],
  incoming: [],
};

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/ontology/types")) return jsonResponse(KINDS);
      if (url.includes("/api/sparql")) return jsonResponse(BROWSE_ROWS);
      if (url.includes("/api/ontology/resource/")) return jsonResponse(RESOURCE);
      return jsonResponse({}, 404);
    })
  );
}

describe("InstancesPage (TASK-031)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_kind_chips_render_from_ontology_types", async () => {
    stubFetch();
    render(<InstancesPage />);
    await screen.findByRole("button", { name: /Process/ });
    expect(screen.getByRole("button", { name: /Actor/ })).toBeInTheDocument();
  });

  it("test_row_select_opens_inspector_with_props_edges_prov", async () => {
    stubFetch();
    render(<InstancesPage />);
    fireEvent.click(await screen.findByText("Invoice Approval"));

    await waitFor(() => expect(screen.getAllByText("Invoice Approval").length).toBeGreaterThan(1));
    expect(screen.getByText(/History unavailable/)).toBeInTheDocument();
  });

  // R1: "Add entity" must let the user pick a kind, and relationship
  // properties must render as an entity picker, not raw-IRI free text.
  it("add-entity offers a kind picker then relationship entity-pickers", async () => {
    stubFetch();
    render(<InstancesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Add entity" }));

    const kindSelect = await screen.findByRole("combobox", { name: "Kind" });
    expect(screen.getByRole("option", { name: "Process" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Actor" })).toBeInTheDocument();

    fireEvent.change(kindSelect, { target: { value: "https://weave.io/ontology/Process" } });

    // The chosen kind's relationship field renders as EntityPicker (search),
    // never a bare IRI text box.
    expect(await screen.findByText("Performed by")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search entities...")).toBeInTheDocument();
  });

  it("test_view_on_canvas_link_carries_focus_iri", async () => {
    stubFetch();
    render(<InstancesPage />);
    fireEvent.click(await screen.findByText("Invoice Approval"));

    const link = await screen.findByRole("link", { name: /View on canvas/ });
    expect(link).toHaveAttribute("href", `/explorer?focus=${encodeURIComponent("urn:p1")}`);
  });
});
