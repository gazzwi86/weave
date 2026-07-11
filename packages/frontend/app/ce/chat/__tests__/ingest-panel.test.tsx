import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { IngestPanel } from "../ingest-panel";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(handler: (url: string) => Response): void {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => handler(String(input))));
}

const PROPOSAL = {
  id: "p1",
  ops: [{ op: "add_node", ref: "n1", kind: "Process", label: "Onboarding" }],
  confidence: 0.9,
  matched_iri: null,
  reason: "found in section 2",
  status: "pending" as const,
  source_span: "Intro > Onboarding",
  low_confidence: false,
};

function stubHappyPath(): void {
  stubFetch((url) => {
    if (url.endsWith("/api/ingest/artefacts")) return jsonResponse(201, { artefact_iri: "urn:a1", job_id: "job-1" });
    if (url === "/api/ingest/jobs/job-1") {
      return jsonResponse(200, { job_id: "job-1", status: "awaiting-review", kind: "doc", artefact_iri: "urn:a1", error: null });
    }
    if (url === "/api/ingest/jobs/job-1/proposals") return jsonResponse(200, { proposals: [PROPOSAL], has_more: false });
    if (url === "/api/ingest/proposals/p1/accept") return jsonResponse(200, { activity_iri: "urn:a1", version_iri: "urn:v1" });
    throw new Error(`unexpected fetch: ${url}`);
  });
}

async function uploadFile(): Promise<void> {
  const file = new File(["# Runbook"], "runbook.md", { type: "text/markdown" });
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/upload document/i), { target: { files: [file] } });
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("IngestPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("has no axe violations", async () => {
    // axe's internal scan uses real timers -- run this one test outside the
    // fake-timer window the polling tests below need.
    vi.useRealTimers();
    const { container } = render(<IngestPanel />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  // AC-002-01/-03: upload a document, land on an op-list proposal card once
  // extraction finishes.
  it("uploads a document and renders the resulting proposal as a card", async () => {
    stubHappyPath();
    render(<IngestPanel />);

    await uploadFile();

    expect(screen.getByText(/Add a new Process called "Onboarding"/i)).toBeInTheDocument();
    expect(screen.getByText("Intro > Onboarding")).toBeInTheDocument();
  });

  // AC-002-05: accepting a proposal through the panel calls the TASK-012
  // endpoint and the card reflects the resolved status.
  it("accepts a proposal through the panel", async () => {
    stubHappyPath();
    render(<IngestPanel />);
    await uploadFile();

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/^accepted$/i)).toBeInTheDocument();
  });
});
