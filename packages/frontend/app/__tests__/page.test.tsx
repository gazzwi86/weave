import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../page";

describe("Home", () => {
  it("should render the app when visited", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Weave" })).toBeInTheDocument();
  });
});
