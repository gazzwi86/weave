import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DomainFocusNotice } from "../domain-focus-notice";
import type { DomainFocusState } from "../use-domain-focus";

function renderNotice(state: DomainFocusState, onRetry = vi.fn(), onDismiss = vi.fn()) {
  render(<DomainFocusNotice state={state} onRetry={onRetry} onDismiss={onDismiss} />);
  return { onRetry, onDismiss };
}

describe("DomainFocusNotice", () => {
  it.each([{ status: "inactive" as const }, { status: "loading" as const }, { status: "focused" as const }])(
    "renders nothing for status '$status'",
    (state) => {
      renderNotice(state);
      expect(screen.queryByTestId("domain-focus-notice")).not.toBeInTheDocument();
    }
  );

  // AC-2: empty-state message while the rest of the canvas stays de-emphasised.
  it("shows 'This domain has no members' for the empty status", () => {
    renderNotice({ status: "empty" });
    expect(screen.getByText("This domain has no members")).toBeInTheDocument();
  });

  // AC-9: dismissable error notice with a retry option.
  it("shows the error message with Retry and Dismiss controls for the error status", () => {
    const { onRetry, onDismiss } = renderNotice({ status: "error", message: "CE error 503" });

    expect(screen.getByText("CE error 503")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
