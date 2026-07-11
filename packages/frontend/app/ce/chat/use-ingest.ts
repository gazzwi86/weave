import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { IngestJob, IngestProposal, IngestViolation } from "./types";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["awaiting-review", "failed", "done"]);

interface UploadArtefactResponse {
  job_id: string;
}

interface ProposalsResponse {
  proposals: IngestProposal[];
}

interface AcceptRejectResponse {
  violations?: IngestViolation[];
}

async function postJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? ((await response.json()) as T) : null;
  return { status: response.status, body };
}

async function fetchJob(jobId: string): Promise<IngestJob | null> {
  const { status, body } = await postJson<IngestJob>(`/api/ingest/jobs/${jobId}`);
  return status === 200 ? body : null;
}

async function fetchProposals(jobId: string): Promise<IngestProposal[]> {
  const { status, body } = await postJson<ProposalsResponse>(`/api/ingest/jobs/${jobId}/proposals`);
  return status === 200 && body ? body.proposals : [];
}

interface JobPolling {
  job: IngestJob | null;
  proposals: IngestProposal[];
  setProposals: Dispatch<SetStateAction<IngestProposal[]>>;
  startPolling: (jobId: string) => Promise<void>;
}

/** Owns the "poll job status until terminal, then load proposals" loop
 * (AC-002-01/-03), separated out so `useIngest` itself stays under the
 * function-length budget.
 */
function useJobPolling(): JobPolling {
  const [job, setJob] = useState<IngestJob | null>(null);
  const [proposals, setProposals] = useState<IngestProposal[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (jobId: string): Promise<boolean> => {
      const latest = await fetchJob(jobId);
      if (!latest) return false;
      setJob(latest);
      if (!TERMINAL_STATUSES.has(latest.status)) return false;
      stopPolling();
      if (latest.status === "awaiting-review") {
        setProposals(await fetchProposals(jobId));
      }
      return true;
    },
    [stopPolling]
  );

  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(
    async (jobId: string) => {
      setJob({ job_id: jobId, status: "queued", kind: "", artefact_iri: "", error: null });
      const alreadyTerminal = await pollOnce(jobId);
      if (alreadyTerminal) return;
      pollTimer.current = setInterval(() => void pollOnce(jobId), POLL_INTERVAL_MS);
    },
    [pollOnce]
  );

  return { job, proposals, setProposals, startPolling };
}

export interface UseIngestResult {
  job: IngestJob | null;
  proposals: IngestProposal[];
  violations: Record<string, IngestViolation[]>;
  uploading: boolean;
  uploadError: string | null;
  upload: (file: File) => Promise<void>;
  accept: (proposalId: string) => Promise<void>;
  reject: (proposalId: string) => Promise<void>;
}

/** TASK-013 E12-S1: drives the chat panel's document-ingest review surface --
 * upload an artefact, poll its extraction job until proposals are ready
 * (AC-002-01/-03), then accept/reject individual proposals through the
 * TASK-012 endpoints (AC-002-05). Confidence/low_confidence is always the
 * server's number -- this hook never recomputes it (AC-002-04).
 */
export function useIngest(): UseIngestResult {
  const { job, proposals, setProposals, startPolling } = useJobPolling();
  const [violations, setViolations] = useState<Record<string, IngestViolation[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);
      const form = new FormData();
      form.set("file", file);
      const { status, body } = await postJson<UploadArtefactResponse & { error?: string }>("/api/ingest/artefacts", {
        method: "POST",
        body: form,
      });
      setUploading(false);
      if (status !== 201 || !body?.job_id) {
        setUploadError(body?.error ?? `upload failed (${status})`);
        return;
      }
      await startPolling(body.job_id);
    },
    [startPolling]
  );

  const setProposalStatus = useCallback(
    (proposalId: string, status: IngestProposal["status"]) => {
      setProposals((current) => current.map((p) => (p.id === proposalId ? { ...p, status } : p)));
    },
    [setProposals]
  );

  const accept = useCallback(async (proposalId: string) => {
    const { status, body } = await postJson<AcceptRejectResponse>(`/api/ingest/proposals/${proposalId}/accept`, {
      method: "POST",
    });
    if (status === 422 && body?.violations) {
      setViolations((current) => ({ ...current, [proposalId]: body.violations! }));
      return;
    }
    setViolations((current) => ({ ...current, [proposalId]: [] }));
    setProposalStatus(proposalId, "accepted");
  }, [setProposalStatus]);

  const reject = useCallback(async (proposalId: string) => {
    await postJson(`/api/ingest/proposals/${proposalId}/reject`, { method: "POST" });
    setProposalStatus(proposalId, "rejected");
  }, [setProposalStatus]);

  return { job, proposals, violations, uploading, uploadError, upload, accept, reject };
}
