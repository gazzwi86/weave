import { useCallback, useRef, useState } from "react";

import type { IngestJob, IngestProposal, IngestViolation } from "../chat/types";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["awaiting-review", "failed", "done"]);

export interface ImportContext {
  source_system?: string;
  owner?: string;
  date_of_truth?: string;
  sensitivity?: string;
  context?: string;
}

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

const isSuccessStatus = (status: number): boolean => status >= 200 && status < 300;

function requestFailureViolation(proposalId: string, status: number): IngestViolation {
  return {
    focus_node: proposalId,
    path: null,
    severity: "Error",
    message: `Request failed (status ${status}). Please try again.`,
  };
}

/** Builds the multipart body the `/api/ingest/artefacts` proxy expects --
 * mirrors the chat panel's field whitelist (FR-044); blank fields are
 * omitted rather than sent empty (AC-008-01: skipping the context step
 * still proceeds).
 */
function buildUploadForm(file: File, context: ImportContext): FormData {
  const form = new FormData();
  form.set("file", file);
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" && value.length > 0) form.set(key, value);
  }
  return form;
}

async function fetchJob(jobId: string): Promise<IngestJob | null> {
  const { status, body } = await postJson<IngestJob>(`/api/ingest/jobs/${jobId}`);
  return status === 200 ? body : null;
}

async function fetchProposals(jobId: string): Promise<IngestProposal[]> {
  const { status, body } = await postJson<ProposalsResponse>(`/api/ingest/jobs/${jobId}/proposals`);
  return status === 200 && body ? body.proposals : [];
}

interface JobTracking {
  jobs: IngestJob[];
  proposals: Record<string, IngestProposal[]>;
  setProposals: (updater: (current: Record<string, IngestProposal[]>) => Record<string, IngestProposal[]>) => void;
  uploading: boolean;
  uploadError: string | null;
  upload: (file: File, context: ImportContext) => Promise<void>;
}

/** Owns upload + the per-job "poll until terminal" loop (AC-008-01), split
 * out so `useImportSession` stays under the function-length budget --
 * mirrors `use-ingest.ts`'s `useJobPolling` extraction.
 */
function useJobTracking(): JobTracking {
  const [jobs, setJobs] = useState<Record<string, IngestJob>>({});
  const [jobOrder, setJobOrder] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Record<string, IngestProposal[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stopPolling = useCallback((jobId: string) => {
    const timer = pollTimers.current[jobId];
    if (timer !== undefined) {
      clearInterval(timer);
      delete pollTimers.current[jobId];
    }
  }, []);

  const pollOnce = useCallback(
    async (jobId: string) => {
      const latest = await fetchJob(jobId);
      if (!latest) return false;
      setJobs((current) => ({ ...current, [jobId]: latest }));
      if (!TERMINAL_STATUSES.has(latest.status)) return false;
      stopPolling(jobId);
      if (latest.status === "awaiting-review") {
        const loaded = await fetchProposals(jobId);
        setProposals((current) => ({ ...current, [jobId]: loaded }));
      }
      return true;
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    async (jobId: string) => {
      const alreadyTerminal = await pollOnce(jobId);
      if (alreadyTerminal) return;
      pollTimers.current[jobId] = setInterval(() => void pollOnce(jobId), POLL_INTERVAL_MS);
    },
    [pollOnce]
  );

  const upload = useCallback(
    async (file: File, context: ImportContext) => {
      setUploading(true);
      setUploadError(null);
      const { status, body } = await postJson<UploadArtefactResponse & { error?: string }>(
        "/api/ingest/artefacts",
        { method: "POST", body: buildUploadForm(file, context) }
      );
      setUploading(false);
      if (status !== 201 || !body?.job_id) {
        setUploadError(body?.error ?? `upload failed (${status})`);
        return;
      }
      const jobId = body.job_id;
      setJobOrder((current) => [jobId, ...current]);
      setJobs((current) => ({
        ...current,
        [jobId]: { job_id: jobId, status: "queued", kind: "", artefact_iri: "", error: null },
      }));
      await startPolling(jobId);
    },
    [startPolling]
  );

  return {
    jobs: jobOrder.map((id) => jobs[id]).filter((j): j is IngestJob => j !== undefined),
    proposals,
    setProposals,
    uploading,
    uploadError,
    upload,
  };
}

interface ProposalActions {
  violations: Record<string, IngestViolation[]>;
  accept: (jobId: string, proposalId: string) => Promise<void>;
  reject: (jobId: string, proposalId: string) => Promise<void>;
}

/** Owns accept/reject and their violation/error state (AC-008-02), split
 * out so `useImportSession` stays under the function-length budget --
 * mirrors `use-ingest.ts`'s `useProposalActions` extraction.
 */
function useProposalActions(
  setProposalStatus: (jobId: string, proposalId: string, status: IngestProposal["status"]) => void
): ProposalActions {
  const [violations, setViolations] = useState<Record<string, IngestViolation[]>>({});

  const setProposalViolations = useCallback((proposalId: string, next: IngestViolation[]) => {
    setViolations((current) => ({ ...current, [proposalId]: next }));
  }, []);

  const resolve = useCallback(
    async (
      jobId: string,
      proposalId: string,
      url: string,
      nextStatus: IngestProposal["status"]
    ) => {
      const { status, body } = await postJson<AcceptRejectResponse>(url, { method: "POST" });
      if (status === 422 && body?.violations) {
        setProposalViolations(proposalId, body.violations);
        return;
      }
      if (!isSuccessStatus(status)) {
        setProposalViolations(proposalId, [requestFailureViolation(proposalId, status)]);
        return;
      }
      setProposalViolations(proposalId, []);
      setProposalStatus(jobId, proposalId, nextStatus);
    },
    [setProposalStatus, setProposalViolations]
  );

  const accept = useCallback(
    (jobId: string, proposalId: string) =>
      resolve(jobId, proposalId, `/api/ingest/proposals/${proposalId}/accept`, "accepted"),
    [resolve]
  );

  const reject = useCallback(
    (jobId: string, proposalId: string) =>
      resolve(jobId, proposalId, `/api/ingest/proposals/${proposalId}/reject`, "rejected"),
    [resolve]
  );

  return { violations, accept, reject };
}

export interface UseImportSessionResult {
  jobs: IngestJob[];
  proposalsFor: (jobId: string) => IngestProposal[];
  violationsFor: (proposalId: string) => IngestViolation[];
  uploading: boolean;
  uploadError: string | null;
  upload: (file: File, context: ImportContext) => Promise<void>;
  accept: (jobId: string, proposalId: string) => Promise<void>;
  reject: (jobId: string, proposalId: string) => Promise<void>;
}

/** CE-V1-TASK-019 (AC-008-01/-02): drives the `/ce/import` page -- each
 * upload appends a job to client-tracked history (no server "list all
 * jobs" endpoint exists yet, see TASK-019 deferral ledger) and polls it
 * independently via the same TASK-012 per-job endpoints `useIngest`
 * (chat panel) already uses.
 */
export function useImportSession(): UseImportSessionResult {
  const { jobs, proposals, setProposals, uploading, uploadError, upload } = useJobTracking();

  const setProposalStatus = useCallback(
    (jobId: string, proposalId: string, status: IngestProposal["status"]) => {
      setProposals((current) => ({
        ...current,
        [jobId]: (current[jobId] ?? []).map((p) => (p.id === proposalId ? { ...p, status } : p)),
      }));
    },
    [setProposals]
  );

  const { violations, accept, reject } = useProposalActions(setProposalStatus);

  const proposalsFor = useCallback((jobId: string) => proposals[jobId] ?? [], [proposals]);
  const violationsFor = useCallback((proposalId: string) => violations[proposalId] ?? [], [violations]);

  return { jobs, proposalsFor, violationsFor, uploading, uploadError, upload, accept, reject };
}
