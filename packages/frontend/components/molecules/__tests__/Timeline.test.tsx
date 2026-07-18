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

  it("does not warn on duplicate React keys when two actions on an entry share a label", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const entries = [
      { ...LATEST_ENTRY, actions: [{ label: "Diff", onClick: vi.fn() }, { label: "Diff", onClick: vi.fn() }] },
    ];
    render(<Timeline entries={entries} />);
    expect(errorSpy.mock.calls.join(" ")).not.toMatch(/same key/i);
    errorSpy.mockRestore();
  });

  it("renders an entry's expandedContent when present", () => {
    const entries = [{ ...OLDER_ENTRY, expandedContent: <p>Gap note text</p> }];
    render(<Timeline entries={entries} />);
    expect(screen.getByText("Gap note text")).toBeInTheDocument();
  });

  it("omits expandedContent entirely when an entry has none", () => {
    render(<Timeline entries={[OLDER_ENTRY]} />);
    expect(screen.queryByText("Gap note text")).not.toBeInTheDocument();
  });
});
