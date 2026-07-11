import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CanvasToolbar } from "../canvas-toolbar";

describe("CanvasToolbar", () => {
  it("docks top-left and renders its slotted children (D-3, e.g. the search trigger)", () => {
    render(
      <CanvasToolbar>
        <button type="button">Search</button>
      </CanvasToolbar>
    );

    expect(screen.getByTestId("explorer-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });
});
