import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IngestProposalCard } from "../ingest-proposal-card";
import type { IngestProposal, IngestViolation } from "../types";

const PROPOSAL: IngestProposal = {
  id: "p1",
  ops: [{ op: "add_node", ref: "n1", kind: "Process", label: "Onboarding" }],
  confidence: 0.92,
  matched_iri: "urn:weave:process:existing-1",
  reason: "matches section 2 heading",
  status: "pending",
  source_span: "Intro > Onboarding",
  low_confidence: false,
};

const LOW_CONF_PROPOSAL: IngestProposal = {
  ...PROPOSAL,
  id: "p2",
  confidence: 0.31,
  low_confidence: true,
  matched_iri: null,
};

describe("IngestProposalCard", () => {
  // AC-002-03: op-list-not-Turtle, matched-resource link, confidence badge,
  // source-span locator (ADR-011) all visible on one card.
  it("renders the op label, kind, matched-resource link, confidence badge, and source span", () => {
    render(<IngestProposalCard proposal={PROPOSAL} violations={[]} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText(/Add a new Process called "Onboarding"/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /urn:weave:process:existing-1/ })).toHaveAttribute(
      "href",
      "/explorer?focus=urn%3Aweave%3Aprocess%3Aexisting-1"
    );
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Intro > Onboarding")).toBeInTheDocument();
  });

  // AC-002-04: low-confidence is flagged and the Accept control is never
  // rendered pre-selected/auto-triggered -- it stays a deliberate click.
  it("flags a low-confidence proposal without pre-selecting accept", () => {
    render(<IngestProposalCard proposal={LOW_CONF_PROPOSAL} violations={[]} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    const acceptButton = screen.getByRole("button", { name: /accept/i });
    expect(acceptButton).not.toHaveAttribute("aria-pressed", "true");
    expect(acceptButton).not.toBeDisabled();
  });

  // AC-002-05: accept/reject call back per-proposal.
  it("calls onAccept and onReject with the proposal id", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<IngestProposalCard proposal={PROPOSAL} violations={[]} onAccept={onAccept} onReject={onReject} />);

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith("p1");

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith("p1");
  });

  // AC-002-05: a 422 SHACL violation is rendered on the offending card.
  it("renders SHACL violations returned from a 422 accept response", () => {
    const violations: IngestViolation[] = [
      { focus_node: "urn:n1", path: "owner", severity: "Violation", message: "Owner is required" },
    ];
    render(<IngestProposalCard proposal={PROPOSAL} violations={violations} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText("Owner is required")).toBeInTheDocument();
  });

  // Accepted/rejected proposals show their resolved status and no longer
  // offer accept/reject actions.
  it("shows a resolved status instead of actions once accepted", () => {
    render(
      <IngestProposalCard proposal={{ ...PROPOSAL, status: "accepted" }} violations={[]} onAccept={vi.fn()} onReject={vi.fn()} />
    );

    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });
});
