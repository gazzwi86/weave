import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProjectCanvasPage from "../page";

// T6 placeholder (docs/specs/features/T6_PROJECT_EXPLORER_SPEC.md): the
// project-scoped Explorer is spec'd but deferred -- this route ships a
// placeholder so the intent is visible, not the real canvas.
describe("ProjectCanvasPage", () => {
  it("renders the page header with title and explanatory subtitle", () => {
    render(<ProjectCanvasPage />);

    expect(screen.getByRole("heading", { name: "Model canvas" })).toBeInTheDocument();
    expect(
      screen.getByText(/project-scoped view of your company model/i)
    ).toBeInTheDocument();
  });

  it("shows a coming-soon empty state, no fake progress pill", () => {
    render(<ProjectCanvasPage />);

    expect(screen.getByText("soon")).toBeInTheDocument();
  });
});
