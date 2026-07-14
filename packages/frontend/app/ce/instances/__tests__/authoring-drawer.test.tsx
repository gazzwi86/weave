import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthoringDrawer } from "../authoring-drawer";
import type { KindEntry } from "../../chat/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const SHAPE: KindEntry = {
  iri: "https://weave.io/ontology/Process",
  label: "Process",
  properties: [
    { path: "https://weave.io/ontology/ownedBy", name: "Owned by", is_relationship: true, min_count: 1, max_count: 1, severity: "Violation" },
  ],
};

describe("AuthoringDrawer (TASK-031 AC-5/AC-6/AC-7)", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("test_authoring_drawer_kind_persistent_and_entity_pickers", () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ results: [] })));
    render(<AuthoringDrawer shape={SHAPE} mode="create" onClose={() => {}} />);

    expect(screen.getAllByText("Process").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Owned by/)).toBeInTheDocument();
  });

  it("test_onblur_structural_check_and_submit_422_map_to_field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/operations/apply")) {
          return jsonResponse({ violations: [{ path: "label", message: "Label is required." }] }, 422);
        }
        return jsonResponse({ results: [] });
      })
    );
    render(<AuthoringDrawer shape={SHAPE} mode="create" onClose={() => {}} />);

    const labelInput = screen.getByLabelText(/Label/);
    fireEvent.blur(labelInput);
    await screen.findByText(/Label is required \(min count 1\)/);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Label is required.")).toBeInTheDocument());
  });

  it("test_create_confirmation_friendly_label_mono_id_no_raw_iri", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/operations/apply")) {
          return jsonResponse(
            { ref_map: { form1: "https://weave.io/data/proc-123" }, activity_iri: "urn:activity:abc" },
            201
          );
        }
        return jsonResponse({ results: [] });
      })
    );
    render(<AuthoringDrawer shape={SHAPE} mode="create" onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Label/), { target: { value: "Invoice Approval" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Invoice Approval");
    expect(screen.queryByText(/https:\/\/weave\.io/)).not.toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();
  });
});
