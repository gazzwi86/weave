import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { describeOp } from "./explain";
import type { IngestProposal, IngestViolation } from "./types";

function ConfidenceBadge({ proposal }: { proposal: IngestProposal }) {
  const pct = `${Math.round(proposal.confidence * 100)}%`;
  if (proposal.low_confidence) {
    return <Badge variant="warn">Low confidence ({pct})</Badge>;
  }
  return <Badge variant="success">{pct}</Badge>;
}

function MatchedResourceLink({ iri }: { iri: string }) {
  return (
    <a href={`/explorer?focus=${encodeURIComponent(iri)}`} className="underline text-[var(--color-accent-primary)]">
      {iri}
    </a>
  );
}

function ViolationList({ violations }: { violations: IngestViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-danger)]">
      {violations.map((violation, index) => (
        // Violations carry no stable id from the backend; index is fine --
        // this list is rebuilt wholesale on every accept attempt.
        <li key={index}>{violation.message}</li>
      ))}
    </ul>
  );
}

/** Once a proposal is resolved (accepted/rejected) it shows its outcome
 * instead of action buttons -- there is nothing left to decide.
 */
function ResolvedStatus({ status }: { status: IngestProposal["status"] }) {
  return <Badge variant={status === "accepted" ? "success" : "neutral"}>{status}</Badge>;
}

interface IngestProposalCardProps {
  proposal: IngestProposal;
  violations: IngestViolation[];
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

/** TASK-013 AC-002-03/-04/-05: one op-list-not-Turtle card per ingest
 * proposal -- reuses `describeOp` (TASK-006) for the per-op sentence so the
 * ingest surface never forks the authoring chat's op->text mapping. Kind is
 * shown as the extractor already resolved it (CE-READ-1 is the catalogue's
 * source of truth server-side; this card never re-derives it).
 */
export function IngestProposalCard({ proposal, violations, onAccept, onReject }: IngestProposalCardProps) {
  const isPending = proposal.status === "pending";
  return (
    <li className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
      <ul className="flex flex-col gap-[var(--space-1)]">
        {proposal.ops.map((op, index) => (
          // ops carry no stable id; order is stable within a proposal.
          <li key={index}>{describeOp(op)}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <ConfidenceBadge proposal={proposal} />
        {proposal.matched_iri && <MatchedResourceLink iri={proposal.matched_iri} />}
      </div>

      {proposal.source_span && (
        <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">{proposal.source_span}</p>
      )}

      <ViolationList violations={violations} />

      {isPending ? (
        <div className="flex gap-[var(--space-2)]">
          <Button type="button" onClick={() => onAccept(proposal.id)}>
            Accept
          </Button>
          <Button type="button" variant="secondary" onClick={() => onReject(proposal.id)}>
            Reject
          </Button>
        </div>
      ) : (
        <ResolvedStatus status={proposal.status} />
      )}
    </li>
  );
}
