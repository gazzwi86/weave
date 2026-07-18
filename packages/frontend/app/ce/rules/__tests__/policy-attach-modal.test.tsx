import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolicyAttachModal } from "../policy-attach-modal";

const POLICY = { iri: "urn:weave:instances:policy-1", label: "Vendor risk policy" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function selectFirstOption(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Search entities"), { target: { value: "onboard" } });
  await waitFor(() => expect(screen.getByText("Onboard vendor")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onboard vendor"));
}

describe("PolicyAttachModal", () => {
  it("attaches every selected entity via add_edge and closes on full success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("typeahead")) {
          return jsonResponse(200, {
            results: [{ iri: "urn:weave:instances:process-1", label: "Onboard vendor", kind: "process" }],
          });
        }
        return jsonResponse(201, { applied_count: 1, version_iri: "urn:v1" });
      })
    );
    const onClose = vi.fn();
    const onAttached = vi.fn();

    render(<PolicyAttachModal policy={POLICY} onClose={onClose} onAttached={onAttached} />);
    await selectFirstOption();
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onAttached).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/operations/apply",
      expect.objectContaining({
        body: JSON.stringify({
          operations: [
            {
              op: "add_edge",
              subject_ref: "urn:weave:instances:process-1",
              predicate: "https://weave.example/ontology/bpmo#governedBy",
              object_ref: "urn:weave:instances:policy-1",
            },
          ],
        }),
      })
    );
  });

  it("reports a partial failure without closing the modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("typeahead")) {
          return jsonResponse(200, {
            results: [{ iri: "urn:weave:instances:process-1", label: "Onboard vendor", kind: "process" }],
          });
        }
        return jsonResponse(422, { violations: [{ path: null, message: "Cannot link to a retired entity." }] });
      })
    );
    const onClose = vi.fn();

    render(<PolicyAttachModal policy={POLICY} onClose={onClose} onAttached={vi.fn()} />);
    await selectFirstOption();
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(screen.getByText("Cannot link to a retired entity.")).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
