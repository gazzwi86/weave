import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useImportSession } from "../use-import";

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init))
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

// AC-008-01: JobList tracks every upload made in the page session (no
// server-side "list all jobs" endpoint exists -- CE-V1-TASK-012/013 only
// ship single-job reads, so the list is client-tracked upload history,
// each entry independently polled via the existing per-job endpoint).
describe("useImportSession", () => {
  it("should track multiple upload jobs and list their statuses", async () => {
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
        });
      }
      if (url === "/api/ingest/jobs/job-1/proposals") {
        return jsonResponse(200, { proposals: [PROPOSAL], has_more: false });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const { result } = renderHook(() => useImportSession());

    await act(async () => {
      await result.current.upload(new File(["hello"], "doc.md"), {});
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs.at(0)?.job_id).toBe("job-1");
    expect(result.current.jobs.at(0)?.status).toBe("awaiting-review");
  });

  it("should allow skipping the context step and still submit the upload", async () => {
    let sentForm: FormData | undefined;
    stubFetch((url, init) => {
      if (url.endsWith("/api/ingest/artefacts")) {
        sentForm = init?.body as FormData;
        return jsonResponse(201, { job_id: "job-2", artefact_iri: "urn:a2" });
      }
      return jsonResponse(200, {
        job_id: "job-2",
        status: "extracting",
        kind: "document",
        artefact_iri: "urn:a2",
        error: null,
      });
    });

    const { result } = renderHook(() => useImportSession());

    await act(async () => {
      await result.current.upload(new File(["hi"], "doc.md"), {});
    });

    expect(sentForm?.get("source_system")).toBeNull();
    expect(result.current.jobs).toHaveLength(1);
  });

  it("should render 422 violations inline against the proposal on accept", async () => {
    stubFetch((url) => {
      if (url.endsWith("/api/ingest/artefacts")) {
        return jsonResponse(201, { job_id: "job-3", artefact_iri: "urn:a3" });
      }
      if (url === "/api/ingest/jobs/job-3") {
        return jsonResponse(200, {
          job_id: "job-3",
          status: "awaiting-review",
          kind: "document",
          artefact_iri: "urn:a3",
          error: null,
        });
      }
      if (url === "/api/ingest/jobs/job-3/proposals") {
        return jsonResponse(200, { proposals: [PROPOSAL], has_more: false });
      }
      if (url === "/api/ingest/proposals/p1/accept") {
        return jsonResponse(422, {
          violations: [{ focus_node: "p1", path: null, severity: "Error", message: "missing owner" }],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const { result } = renderHook(() => useImportSession());
    await act(async () => {
      await result.current.upload(new File(["hi"], "doc.md"), {});
    });
    expect(result.current.proposalsFor("job-3")).toHaveLength(1);

    await act(async () => {
      await result.current.accept("job-3", "p1");
    });

    expect(result.current.violationsFor("p1")).toEqual([
      { focus_node: "p1", path: null, severity: "Error", message: "missing owner" },
    ]);
    expect(result.current.proposalsFor("job-3").at(0)?.status).toBe("pending");
  });
});
