import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobList } from "../job-list";
import type { IngestJob } from "../../chat/types";

// CE-V1-TASK-019 QA edge case (AC-008-01): empty state, summary rendering,
// and job selection weren't directly unit-tested -- only indirectly via
// page.test.tsx's happy path (which never reaches an empty list or a job
// with a populated `summary`).
describe("JobList", () => {
  it("should show an empty-state message when there are no uploads yet", () => {
    render(<JobList jobs={[]} selectedJobId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no uploads yet/i)).toBeInTheDocument();
  });

  it("should render the committed/skipped/rejected summary when a job has one, and call onSelect on click", () => {
    const job: IngestJob = {
      job_id: "job-1",
      status: "done",
      kind: "document",
      artefact_iri: "urn:a1",
      error: null,
      summary: { committed: 2, skipped: 1, rejected: 0 },
    };
    const onSelect = vi.fn();
    render(<JobList jobs={[job]} selectedJobId={null} onSelect={onSelect} />);

    expect(screen.getByText(/2 committed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/0 rejected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /urn:a1/i }));
    expect(onSelect).toHaveBeenCalledWith("job-1");
  });

  it("should not render a summary when the job has none", () => {
    const job: IngestJob = {
      job_id: "job-2",
      status: "queued",
      kind: "document",
      artefact_iri: "",
      error: null,
      summary: null,
    };
    render(<JobList jobs={[job]} selectedJobId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText(/committed/i)).not.toBeInTheDocument();
    // Falls back to job_id when artefact_iri is empty.
    expect(screen.getByText("job-2")).toBeInTheDocument();
  });
});
