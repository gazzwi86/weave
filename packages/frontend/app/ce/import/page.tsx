"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { IngestProposalCard } from "../chat/ingest-proposal-card";
import { ContextStep } from "./context-step";
import { JobList } from "./job-list";
import { useImportSession } from "./use-import";

/** CE-V1-TASK-019 (AC-008-01/-02): the Import & Ingest page -- upload w/
 * optional FR-044 context step, live job list, and per-proposal review
 * (op-list renderer, reused from TASK-013's chat panel).
 *
 * Partial-epic slice (see `.claude/state/escalations/CE-V1-TASK-019-partial.md`):
 * EPIC-012 stays open. This page ships the document-import path only --
 * mapping-row (structured import) and merge-side-by-side (SKOS
 * reconciliation) renderers are deferred, since TASK-015/017/018 (their
 * data source) don't exist yet. `ProposalReview` is intentionally a single
 * renderer, not a kind-based switch, until there's a second kind to
 * switch on.
 */
export default function CeImportPage() {
  const { jobs, proposalsFor, violationsFor, uploading, uploadError, upload, accept, reject } =
    useImportSession();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Newest upload becomes the active review target once its job_id exists
  // (jobs[0] -- use-import.ts prepends new uploads).
  const handleUpload = (file: File, context: Parameters<typeof upload>[1]): void => {
    void upload(file, context);
  };

  const activeJobId = selectedJobId ?? jobs[0]?.job_id ?? null;
  const proposals = activeJobId ? proposalsFor(activeJobId) : [];

  return (
    <main data-tour-id="ce.import" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Import & Ingest
        </h1>
        <Badge variant="info">v1.0 — document import</Badge>
      </div>

      <Card>
        <CardContent>
          <ContextStep uploading={uploading} onUpload={handleUpload} />
          {uploadError && <p className="text-[var(--color-danger)]">{uploadError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <JobList jobs={jobs} selectedJobId={activeJobId} onSelect={setSelectedJobId} />
        </CardContent>
      </Card>

      {proposals.length > 0 && activeJobId && (
        <Card>
          <CardContent>
            <ul className="flex flex-col gap-[var(--space-2)]">
              {proposals.map((proposal) => (
                <IngestProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  violations={violationsFor(proposal.id)}
                  onAccept={(proposalId) => void accept(activeJobId, proposalId)}
                  onReject={(proposalId) => void reject(activeJobId, proposalId)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
