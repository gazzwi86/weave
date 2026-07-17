import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Timeline, type TimelineEntry } from "../Timeline";

const LATEST_ENTRY: TimelineEntry = {
  id: "v14",
  version: "v14",
  timestamp: "2026-07-17 09:12",
  author: "Priya Shah",
  description: "6 changes — refund step added to Order handling.",
  latest: true,
  actions: [{ label: "Diff vs v13", onClick: vi.fn() }],
};
const OLDER_ENTRY: TimelineEntry = {
  id: "v13",
  version: "v13",
  timestamp: "2026-07-12 15:40",
  author: "Marco Diaz",
  description: "11 changes — Fulfilment capability remodelled.",
};
const ENTRIES: TimelineEntry[] = [LATEST_ENTRY, OLDER_ENTRY];

describe("Timeline", () => {
  it("renders a card per entry with version, meta and description", () => {
    render(<Timeline entries={ENTRIES} />);
    expect(screen.getByText("v14")).toBeInTheDocument();
    expect(screen.getByText("v13")).toBeInTheDocument();
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument();
    expect(screen.getByText(/Fulfilment capability remodelled/)).toBeInTheDocument();
  });

  it("shows a latest badge only for entries marked latest", () => {
    render(<Timeline entries={ENTRIES} />);
    expect(screen.getByText("latest")).toBeInTheDocument();
    expect(screen.getAllByText("latest")).toHaveLength(1);
  });

  it("calls an entry action's onClick when clicked", () => {
    const onClick = vi.fn();
    const entries = [{ ...LATEST_ENTRY, actions: [{ label: "Diff vs v13", onClick }] }];
    render(<Timeline entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "Diff vs v13" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the actions row when an entry has none", () => {
    const entries = [{ ...OLDER_ENTRY, actions: undefined }];
    render(<Timeline entries={entries} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
