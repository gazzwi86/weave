import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIngest } from "../use-ingest";

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init))
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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

const LOW_CONF_PROPOSAL = { ...PROPOSAL, id: "p2", confidence: 0.3, low_confidence: true };

const ARTEFACTS_URL = "/api/ingest/artefacts";
const JOB_URL = "/api/ingest/jobs/job-1";
const PROPOSALS_URL = "/api/ingest/jobs/job-1/proposals";

/** Common upload+poll-to-awaiting-review stub shared by the accept/reject
 * tests, each of which only cares about a single proposal already loaded.
 */
function stubAwaitingReviewWith(extra: (url: string) => Response | undefined): void {
  stubFetch((url) => {
    if (url.endsWith(ARTEFACTS_URL)) return jsonResponse(201, { artefact_iri: "urn:a1", job_id: "job-1" });
    if (url === JOB_URL) {
      return jsonResponse(200, { job_id: "job-1", status: "awaiting-review", kind: "doc", artefact_iri: "urn:a1", error: null });
    }
    if (url === PROPOSALS_URL) return jsonResponse(200, { proposals: [PROPOSAL], has_more: false });
    const response = extra(url);
    if (response) return response;
    throw new Error(`unexpected fetch: ${url}`);
  });
}

/** Drives upload -> poll(extracting once, then awaiting-review) -> proposals
 * fetch, so accept/reject tests start from a real "proposals loaded" state
 * instead of reaching into hook internals.
 */
async function uploadToAwaitingReview(
  result: { current: ReturnType<typeof useIngest> },
  proposals: typeof PROPOSAL[]
): Promise<void> {
  await act(async () => {
    await result.current.upload(new File(["# Title"], "runbook.md", { type: "text/markdown" }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.proposals).toHaveLength(proposals.length);
}

describe("useIngest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // AC-002-01/-03: upload -> poll job status -> once awaiting-review, fetch
  // and expose the proposal list (incl. the never-pre-selected low-confidence
  // flag, AC-002-04).
  it("uploads a file, polls until awaiting-review, then exposes proposals", async () => {
    let jobCalls = 0;
    stubFetch((url) => {
      if (url.endsWith("/api/ingest/artefacts")) {
        return jsonResponse(201, { artefact_iri: "urn:a1", job_id: "job-1" });
      }
      if (url === "/api/ingest/jobs/job-1") {
        jobCalls += 1;
        const status = jobCalls < 2 ? "extracting" : "awaiting-review";
        return jsonResponse(200, { job_id: "job-1", status, kind: "doc", artefact_iri: "urn:a1", error: null });
      }
      if (url === "/api/ingest/jobs/job-1/proposals") {
        return jsonResponse(200, { proposals: [PROPOSAL, LOW_CONF_PROPOSAL], has_more: false });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL, LOW_CONF_PROPOSAL]);

    expect(result.current.job?.status).toBe("awaiting-review");
    const lowConf = result.current.proposals.find((p) => p.id === "p2");
    expect(lowConf?.low_confidence).toBe(true);
  });

  it("surfaces a 503 upload error and creates no job (AC-002-06)", async () => {
    stubFetch(() => jsonResponse(503, { error: "model_unavailable" }));

    const { result } = renderHook(() => useIngest());
    await act(async () => {
      await result.current.upload(new File(["x"], "notes.md"));
    });

    expect(result.current.job).toBeNull();
    expect(result.current.uploadError).toBeTruthy();
  });

  it("accept: marks the proposal accepted on 200 (AC-002-05)", async () => {
    stubAwaitingReviewWith((url) =>
      url === "/api/ingest/proposals/p1/accept" ? jsonResponse(200, { activity_iri: "urn:a1", version_iri: "urn:v1" }) : undefined
    );
    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL]);

    await act(async () => {
      await result.current.accept("p1");
    });

    expect(result.current.proposals.find((p) => p.id === "p1")?.status).toBe("accepted");
  });

  it("accept: on 422, keeps the proposal pending and records violations on it (AC-002-05)", async () => {
    stubAwaitingReviewWith((url) =>
      url === "/api/ingest/proposals/p1/accept"
        ? jsonResponse(422, { violations: [{ focus_node: "n1", path: null, severity: "Violation", message: "Owner is required" }] })
        : undefined
    );
    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL]);

    await act(async () => {
      await result.current.accept("p1");
    });

    expect(result.current.proposals.find((p) => p.id === "p1")?.status).toBe("pending");
    expect(result.current.violations.p1?.[0]?.message).toBe("Owner is required");
  });

  it("reject: marks the proposal rejected (AC-002-05)", async () => {
    stubAwaitingReviewWith((url) =>
      url === "/api/ingest/proposals/p1/reject" ? jsonResponse(200, { id: "p1", status: "rejected" }) : undefined
    );
    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL]);

    await act(async () => {
      await result.current.reject("p1");
    });

    expect(result.current.proposals.find((p) => p.id === "p1")?.status).toBe("rejected");
  });

  // QA-fail fix (retry 1): a non-2xx response that isn't the 422-violations
  // shape must never be treated as a resolution -- the card stays pending
  // with a retryable error, never silently "accepted"/"rejected".
  it("accept: on a 502, leaves the proposal pending and surfaces a retryable error (AC-002-05)", async () => {
    stubAwaitingReviewWith((url) =>
      url === "/api/ingest/proposals/p1/accept" ? jsonResponse(502, { error: "upstream_unavailable" }) : undefined
    );
    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL]);

    await act(async () => {
      await result.current.accept("p1");
    });

    expect(result.current.proposals.find((p) => p.id === "p1")?.status).toBe("pending");
    expect(result.current.violations.p1?.[0]?.message).toBeTruthy();
  });

  it("reject: on a 500, leaves the proposal pending and surfaces a retryable error (AC-002-05)", async () => {
    stubAwaitingReviewWith((url) =>
      url === "/api/ingest/proposals/p1/reject" ? jsonResponse(500, { error: "internal_error" }) : undefined
    );
    const { result } = renderHook(() => useIngest());
    await uploadToAwaitingReview(result, [PROPOSAL]);

    await act(async () => {
      await result.current.reject("p1");
    });

    expect(result.current.proposals.find((p) => p.id === "p1")?.status).toBe("pending");
    expect(result.current.violations.p1?.[0]?.message).toBeTruthy();
  });
});
