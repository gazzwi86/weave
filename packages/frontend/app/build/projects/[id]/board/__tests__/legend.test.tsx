import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Legend } from "../legend";

describe("Legend", () => {
  it("should display state legend alongside colour coding", () => {
    render(<Legend />);

    for (const lane of ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"]) {
      expect(screen.getByText(lane)).toBeInTheDocument();
    }
  });
});
