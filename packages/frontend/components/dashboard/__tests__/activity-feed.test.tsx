import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityFeed } from "../activity-feed";

describe("ActivityFeed", () => {
  it("shows an empty state when there are no entries", () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
  });

  it("renders the engine tag and a target label derived from the IRI", () => {
    render(
      <ActivityFeed
        entries={[
          {
            seq: 1,
            ts: "2026-07-16T10:00:00Z",
            engine: "Build",
            event_type: "run.completed",
            target_iri: "https://weave.io/instances/returns-intake",
          },
        ]}
      />
    );
    expect(screen.getByText("Build")).toBeInTheDocument();
    // Last IRI segment becomes the human label, not the whole URL.
    expect(screen.getByText("returns-intake")).toBeInTheDocument();
    expect(screen.queryByText(/weave\.io/)).not.toBeInTheDocument();
  });
});
