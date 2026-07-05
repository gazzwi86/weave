import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("shows the CE error message and calls onRetry when the retry button is clicked (AC-2)", () => {
    const onRetry = vi.fn();
    render(<EmptyState message="CE error 503" onRetry={onRetry} />);

    expect(screen.getByTestId("explorer-empty-state")).toHaveTextContent("CE error 503");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
