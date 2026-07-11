import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RetryChip } from "../retry-chip";
import type { BoardCard } from "../types";

function card(overrides: Partial<BoardCard>): BoardCard {
  return {
    id: "task-1",
    status: "Blocked",
    lane: "Review",
    failure_class: null,
    retry_attempt: null,
    retry_ceiling: null,
    hitl_escalated: false,
    ...overrides,
  };
}

describe("RetryChip", () => {
  it("should show failure class and retry ceiling on card", () => {
    render(
      <RetryChip
        card={card({ failure_class: "syntax", retry_attempt: 2, retry_ceiling: 2, hitl_escalated: true })}
      />
    );

    expect(screen.getByTestId("retry-chip")).toHaveTextContent("syntax 2/2");
    expect(screen.getByText("HITL escalated")).toBeInTheDocument();
  });

  it("renders nothing when the task has never failed", () => {
    const { container } = render(<RetryChip card={card({ failure_class: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
