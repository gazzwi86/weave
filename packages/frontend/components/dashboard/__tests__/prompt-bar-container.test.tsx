import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PromptBarContainer } from "../prompt-bar-container";

const SESSION_KEY = "weave.dashboard.promptBarGeneratedCount";

vi.mock("../prompt-bar", () => ({
  PromptBar: ({
    generatedCount,
    onWidgetGenerated,
  }: {
    generatedCount: number;
    onWidgetGenerated?: () => void;
  }) => (
    <div>
      <span data-testid="count">{generatedCount}</span>
      <button onClick={onWidgetGenerated}>simulate-generate</button>
    </div>
  ),
}));

describe("PromptBarContainer", () => {
  it("starts from any count already recorded this session", () => {
    window.sessionStorage.setItem(SESSION_KEY, "2");

    render(<PromptBarContainer />);

    expect(screen.getByTestId("count")).toHaveTextContent("2");
    window.sessionStorage.removeItem(SESSION_KEY);
  });

  it("persists and re-renders with an incremented count on each generation", () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    render(<PromptBarContainer />);

    fireEvent.click(screen.getByText("simulate-generate"));

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });
});
