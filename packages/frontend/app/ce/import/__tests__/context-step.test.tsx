import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextStep } from "../context-step";

// AC-008-01: the pre-ingestion context step (FR-044) is optional --
// skipping it must still proceed to upload.
describe("ContextStep", () => {
  it("should allow skipping the context step and still submit an upload", () => {
    const onUpload = vi.fn();
    render(<ContextStep onUpload={onUpload} uploading={false} />);

    const file = new File(["hello"], "runbook.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText(/upload document/i), { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file, {});
  });

  it("should include filled context fields when the user provides them", () => {
    const onUpload = vi.fn();
    render(<ContextStep onUpload={onUpload} uploading={false} />);

    fireEvent.change(screen.getByLabelText(/owner/i), { target: { value: "platform-team" } });
    const file = new File(["hello"], "runbook.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText(/upload document/i), { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file, { owner: "platform-team" });
  });
});
