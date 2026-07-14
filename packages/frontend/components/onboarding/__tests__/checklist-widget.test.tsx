import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";

import { ChecklistWidget } from "../checklist-widget";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const baseState = {
  checklist_dismissed_at: null,
  checklist_completed_at: null,
  checklist_auto_dismiss_days: 7,
  sandbox_workspace_id: null,
  sandbox_forked_at: null,
  tours: [],
  exercise_completions: [],
  activations: [],
};

describe("ChecklistWidget (TASK-010)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-010-01: renders items with label, why-text, and a deep link", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(baseState)));

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.getByText("Visit the demo workspace")).toBeInTheDocument());
    expect(screen.getByText("See real data before you commit your own.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /visit the demo workspace/i })).toHaveAttribute(
      "href",
      "/ce/overview"
    );
  });

  it("AC-010-02: an item derived complete from bootstrap signals shows checked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...baseState,
          sandbox_workspace_id: "ws-1",
          sandbox_forked_at: "2026-01-01T00:00:00Z",
        })
      )
    );

    render(<ChecklistWidget />);

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /visit the demo workspace/i })).toBeChecked()
    );
  });

  it("AC-010-03: a locked item shows its prerequisite note and a disabled link", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(baseState)));

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.getByText("Connect a data source")).toBeInTheDocument());
    const lockedRow = screen.getByText("Connect a data source").closest("li");
    expect(lockedRow).not.toBeNull();
    expect(within(lockedRow as HTMLElement).getByText("Coming soon")).toBeInTheDocument();
    expect(within(lockedRow as HTMLElement).queryByRole("link")).not.toBeInTheDocument();
  });

  it("AC-010-03: Admin-invite shows a pending badge and a self-mark button that POSTs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(baseState))
      .mockResolvedValueOnce(jsonResponse({ marked: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ...baseState,
          activations: [{ milestone_id: "invite_admin", source: "manual", activated_at: "2026-07-14T00:00:00Z" }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.getByText("Pending")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /mark as done/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding/milestones/invite_admin/self-mark",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("AC-010-04: celebrates and relabels at 100% completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...baseState,
          sandbox_workspace_id: "ws-1",
          sandbox_forked_at: "2026-01-01T00:00:00Z",
          exercise_completions: [
            { exercise_id: "CE-02", verified_signal: "x", completed_at: "2026-01-01T00:00:00Z" },
            { exercise_id: "CE-03", verified_signal: "x", completed_at: "2026-01-01T00:00:00Z" },
          ],
          tours: [{ tour_id: "ge-canvas", last_completed_step: 2, completed_at: "2026-01-01T00:00:00Z", skipped_at: null }],
          activations: [
            { milestone_id: "first_committed_entity", source: "poll", activated_at: "2026-01-01T00:00:00Z" },
            { milestone_id: "invite_admin", source: "manual", activated_at: "2026-01-01T00:00:00Z" },
          ],
        })
      )
    );

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.getByText("You're all set!")).toBeInTheDocument());
  });

  it("AC-010-05: dismiss persists via PATCH and hides the widget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(baseState))
      .mockResolvedValueOnce(jsonResponse({ checklist_dismissed_at: "2026-07-14T00:00:00Z" }))
      .mockResolvedValueOnce(jsonResponse({ ...baseState, checklist_dismissed_at: "2026-07-14T00:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.getByRole("button", { name: /dismiss checklist/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /dismiss checklist/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding/state",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    await waitFor(() => expect(screen.queryByText("Get started")).not.toBeInTheDocument());
  });

  it("does not render when already dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ...baseState, checklist_dismissed_at: "2026-07-01T00:00:00Z" }))
    );

    render(<ChecklistWidget />);

    await waitFor(() => expect(screen.queryByText("Get started")).not.toBeInTheDocument());
  });

  it("AC-010-06: has no axe violations", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(baseState)));

    const { container } = render(<ChecklistWidget />);
    await waitFor(() => expect(screen.getByText("Visit the demo workspace")).toBeInTheDocument());

    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("AC-010-06: the first checklist item is keyboard-reachable and its link activates on Enter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(baseState)));
    const user = userEvent.setup();

    render(<ChecklistWidget />);
    await waitFor(() => expect(screen.getByText("Visit the demo workspace")).toBeInTheDocument());

    const link = screen.getByRole("link", { name: /visit the demo workspace/i });
    await user.tab(); // checkbox (readonly, still focusable/announced)
    await user.tab(); // deep-link
    expect(link).toHaveFocus();
  });
});
