import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedViewsPanel } from "../saved-views-panel";
import type { UseSavedViewsResult } from "../use-saved-views";

const VIEW = {
  view_id: "v1",
  name: "Q3 review",
  created_by: "https://weave.io/principal/user/alice",
  pinned: false,
  updated_at: "2026-01-01",
  definition: { filterState: { entityTypesOff: [], relTypesOff: [], propertyFilters: [], layersOn: [] }, activeOverlayIds: [], domainFocus: null, viewport: { zoom: 1, pan: { x: 0, y: 0 } } },
};

function baseProps(overrides: Partial<UseSavedViewsResult> = {}): UseSavedViewsResult {
  return {
    views: [VIEW],
    refreshLibrary: vi.fn(),
    save: vi.fn().mockResolvedValue({ status: "created", view_id: "v2" }),
    open: vi.fn().mockResolvedValue({ missingCount: 0 }),
    remove: vi.fn().mockResolvedValue(true),
    share: vi.fn().mockResolvedValue({ notified: 1, excluded: 0 }),
    ...overrides,
  };
}

describe("SavedViewsPanel", () => {
  it("saves a view by name and shows an overwrite prompt on collision (AC-1)", async () => {
    const save = vi.fn().mockResolvedValue({ status: "collision", existing_view_id: "v1" });
    render(<SavedViewsPanel {...baseProps({ save })} />);

    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Q3 review" } });
    fireEvent.click(screen.getByText("Save view"));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith("Q3 review", false);

    fireEvent.click(screen.getByText("Overwrite"));
    expect(save).toHaveBeenLastCalledWith("Q3 review", true);
  });

  it("lists tenant views, using the author's local-part token (AC-4)", () => {
    render(<SavedViewsPanel {...baseProps()} />);
    expect(screen.getByText("Q3 review")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("opens a view on click and deletes it on the delete affordance (AC-2/AC-4)", () => {
    const open = vi.fn().mockResolvedValue({ missingCount: 0 });
    const remove = vi.fn().mockResolvedValue(true);
    render(<SavedViewsPanel {...baseProps({ open, remove })} />);

    fireEvent.click(screen.getByText("Q3 review"));
    expect(open).toHaveBeenCalledWith(VIEW);

    fireEvent.click(screen.getByLabelText("Delete Q3 review"));
    expect(remove).toHaveBeenCalledWith("v1");
  });

  it("shares a view with freeform recipient chips (AC-5, Option-2)", () => {
    const share = vi.fn().mockResolvedValue({ notified: 1, excluded: 0 });
    render(<SavedViewsPanel {...baseProps({ share })} />);

    fireEvent.change(screen.getByLabelText("Add share recipient"), {
      target: { value: "https://weave.io/principal/user/bob" },
    });
    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Share"));

    expect(share).toHaveBeenCalledWith("v1", ["https://weave.io/principal/user/bob"]);
  });
});
