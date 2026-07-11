import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompletenessNotice } from "../completeness-notice";

describe("CompletenessNotice", () => {
  it("renders nothing when there's no notice and no error", () => {
    const { container } = render(<CompletenessNotice notice={null} error={false} onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // AC-2: no-gaps case still shows a notice, no retry offered.
  it("shows the no-gaps message without a retry button", () => {
    render(<CompletenessNotice notice="No coverage gaps found" error={false} onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("No coverage gaps found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  // AC-3: error offers retry + dismiss.
  it("shows an error message with retry and dismiss actions", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<CompletenessNotice notice={null} error={true} onRetry={onRetry} onDismiss={onDismiss} />);
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
    screen.getByRole("button", { name: /dismiss/i }).click();
    expect(onDismiss).toHaveBeenCalled();
  });
});
