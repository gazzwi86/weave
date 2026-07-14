import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CeImportPage from "../page";

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init))
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const FLAGGED_PROPOSAL = {
  id: "p1",
  ops: [{ op: "add_node", ref: "n1", kind: "Process", label: "Vendor Review" }],
  confidence: 0.2,
  matched_iri: null,
  reason: "low confidence extraction",
  status: "pending" as const,
  source_span: "Runbook > Vendor Review",
  low_confidence: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// AC-008-01/-02: upload -> job list -> proposal review, low-confidence
// proposal rendered distinct and never pre-selected; AC-008-02: 422
// violations render inline against the proposal on accept.
describe("CeImportPage", () => {
  it("should render a flagged proposal visually distinct and not pre-selected after upload", async () => {
    stubFetch((url) => {
      if (url.endsWith("/api/ingest/artefacts")) {
        return jsonResponse(201, { job_id: "job-1", artefact_iri: "urn:a1" });
      }
      if (url === "/api/ingest/jobs/job-1") {
        return jsonResponse(200, {
          job_id: "job-1",
          status: "awaiting-review",
          kind: "document",
          artefact_iri: "urn:a1",
          error: null,
          summary: null,
        });
      }
      if (url === "/api/ingest/jobs/job-1/proposals") {
        return jsonResponse(200, { proposals: [FLAGGED_PROPOSAL], has_more: false });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    render(<CeImportPage />);

    const file = new File(["hi"], "runbook.md", { type: "text/markdown" });
    fireEvent.change(await screen.findByLabelText(/upload document/i), { target: { files: [file] } });

    expect(await screen.findByText(/low confidence/i)).toBeVisible();
    const acceptButton = await screen.findByRole("button", { name: "Accept" });
    // Never pre-selected/auto-triggered -- accept still requires a click.
    expect(acceptButton).toBeEnabled();
    expect(screen.queryByText(/^accepted$/i)).not.toBeInTheDocument();
  });

  it("should render 422 violations inline against the proposal when accept fails validation", async () => {
    stubFetch((url) => {
      if (url.endsWith("/api/ingest/artefacts")) {
        return jsonResponse(201, { job_id: "job-2", artefact_iri: "urn:a2" });
      }
      if (url === "/api/ingest/jobs/job-2") {
        return jsonResponse(200, {
          job_id: "job-2",
          status: "awaiting-review",
          kind: "document",
          artefact_iri: "urn:a2",
          error: null,
          summary: null,
        });
      }
      if (url === "/api/ingest/jobs/job-2/proposals") {
        return jsonResponse(200, { proposals: [{ ...FLAGGED_PROPOSAL, low_confidence: false }], has_more: false });
      }
      if (url === "/api/ingest/proposals/p1/accept") {
        return jsonResponse(422, {
          violations: [{ focus_node: "p1", path: null, severity: "Error", message: "Owner is required" }],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    render(<CeImportPage />);
    const file = new File(["hi"], "runbook.md", { type: "text/markdown" });
    fireEvent.change(await screen.findByLabelText(/upload document/i), { target: { files: [file] } });

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    expect(await screen.findByText("Owner is required")).toBeVisible();
    // Still pending -- 422 never resolves the card as accepted.
    expect(await screen.findByRole("button", { name: "Accept" })).toBeVisible();
  });
});
