"use client";

import type { ChangeEvent } from "react";

import { IngestProposalCard } from "./ingest-proposal-card";
import { useIngest } from "./use-ingest";

/** TASK-013 E12-S1: the chat panel's document-ingest review surface (no new
 * page -- TASK-019 owns the import page). Upload an artefact, poll its job,
 * then review/accept/reject each extracted proposal as an op-list card
 * (AC-002-03/-04/-05).
 */
export function IngestPanel() {
  const { job, proposals, violations, uploading, uploadError, upload, accept, reject } = useIngest();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void upload(file);
    event.target.value = "";
  };

  return (
    <section aria-label="Document ingest" className="flex flex-col gap-[var(--space-2)]">
      <label htmlFor="ce-ingest-upload" className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        Upload document
      </label>
      <input id="ce-ingest-upload" type="file" onChange={handleFileChange} disabled={uploading} />

      {uploadError && <p className="text-[length:var(--text-caption)] text-[var(--color-danger)]">{uploadError}</p>}
      {job && job.status !== "awaiting-review" && (
        <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">Status: {job.status}</p>
      )}

      {proposals.length > 0 && (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {proposals.map((proposal) => (
            <IngestProposalCard
              key={proposal.id}
              proposal={proposal}
              violations={violations[proposal.id] ?? []}
              onAccept={accept}
              onReject={reject}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
