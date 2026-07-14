"use client";

import { Badge } from "@/components/ui/badge";

import type { IngestJob } from "../chat/types";

const STATUS_VARIANT: Record<IngestJob["status"], "info" | "success" | "warn" | "neutral"> = {
  queued: "neutral",
  extracting: "info",
  "awaiting-review": "warn",
  done: "success",
  failed: "warn",
};

function SummaryText({ job }: { job: IngestJob }) {
  if (!job.summary) return null;
  const { committed, skipped, rejected } = job.summary;
  return (
    <span className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
      {committed} committed &middot; {skipped} skipped &middot; {rejected} rejected
    </span>
  );
}

interface JobListProps {
  jobs: IngestJob[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
}

/** CE-V1-TASK-019 (AC-008-01): live status + committed/skipped/rejected
 * summary per uploaded job, client-tracked upload history (see the
 * `use-import.ts` doc comment for why there's no server-side job-list
 * endpoint yet).
 */
export function JobList({ jobs, selectedJobId, onSelect }: JobListProps) {
  if (jobs.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No uploads yet.</p>;
  }

  return (
    <ul data-testid="import-job-list" className="flex flex-col gap-[var(--space-2)]">
      {jobs.map((job) => (
        <li key={job.job_id}>
          <button
            type="button"
            onClick={() => onSelect(job.job_id)}
            aria-pressed={job.job_id === selectedJobId}
            className="flex w-full items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-base)] border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-2)] text-left"
          >
            <span className="flex items-center gap-[var(--space-2)]">
              <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
              <span className="text-[var(--color-text-default)]">{job.artefact_iri || job.job_id}</span>
            </span>
            <SummaryText job={job} />
          </button>
        </li>
      ))}
    </ul>
  );
}
