import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExplainBand } from "../explain-band";

describe("ExplainBand", () => {
  it("renders the body for every tone", () => {
    const tones = ["accent", "warn", "success", "danger"] as const;
    for (const tone of tones) {
      const { unmount } = render(<ExplainBand tone={tone} icon="graph" body={`${tone} body`} />);
      expect(screen.getByText(`${tone} body`)).toBeInTheDocument();
      unmount();
    }
  });

  it("omits the action slot when none is given", () => {
    render(<ExplainBand tone="accent" icon="graph" body="No action here." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the trailing action slot when given", () => {
    render(
      <ExplainBand
        tone="warn"
        icon="pencil"
        body="Draft pending."
        action={<button type="button">Publish</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});
