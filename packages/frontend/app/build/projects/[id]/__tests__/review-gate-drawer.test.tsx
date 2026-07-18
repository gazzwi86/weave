import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewGateDrawer } from "../review-gate-drawer";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TASK_DETAIL = {
  brief: {
    title: "RMA approval flow",
    acceptance_criteria: [
      { id: "AC-1", text: "Manager approval required for refunds over $500." },
      { id: "AC-2", text: "RMA state machine enforces approved/rejected/closed." },
    ],
  },
  handoff: [],
  console: { live_channel: null, log_location_ref: null },
  captures_manifest_ref: null,
};

describe("ReviewGateDrawer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("is closed and fetches nothing when taskId is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewGateDrawer open={false} onClose={vi.fn()} projectId="p-1" taskId={null} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Review gate/i)).not.toBeInTheDocument();
  });

  it("loads the task brief and renders the real acceptance-criteria checklist", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(TASK_DETAIL)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={vi.fn()} projectId="p-1" taskId="task-8" />);

    expect(await screen.findByText(/Manager approval required for refunds over \$500/)).toBeInTheDocument();
    expect(screen.getByText(/RMA state machine enforces/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // acceptance criteria StatCard value
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/build/projects/p-1/tasks/task-8")
    );
  });

  it("shows a pending note when the brief has no recorded acceptance criteria", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ ...TASK_DETAIL, brief: { title: "x" } }))
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={vi.fn()} projectId="p-1" taskId="task-8" />);

    expect(await screen.findByText(/no acceptance criteria on file/i)).toBeInTheDocument();
  });

  it("approves via POST /api/build/tasks/{id}/hitl and closes on success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/tasks/task-8") && !init) return Promise.resolve(jsonResponse(TASK_DETAIL));
      if (url.endsWith("/api/build/tasks/task-8/hitl")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ action: "approve" });
        return Promise.resolve(jsonResponse({ action: "resumed" }));
      }
      return Promise.resolve(jsonResponse(TASK_DETAIL));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={onClose} projectId="p-1" taskId="task-8" />);
    await screen.findByText(/Manager approval required/);

    await user.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows an inline error alert (not a crash) on self-approval 403, and keeps the drawer open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hitl")) {
        return Promise.resolve(jsonResponse({ error: "self_approval_not_permitted" }, 403));
      }
      return Promise.resolve(jsonResponse(TASK_DETAIL));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={onClose} projectId="p-1" taskId="task-8" />);
    await screen.findByText(/Manager approval required/);

    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't approve your own work/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends action=reject for 'Request changes' with no comment, and action=amend with a comment", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/hitl")) {
        expect(JSON.parse(String(init?.body))).toEqual({ action: "amend", amendment: "please fix X" });
        return Promise.resolve(jsonResponse({ action: "halted" }));
      }
      return Promise.resolve(jsonResponse(TASK_DETAIL));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={vi.fn()} projectId="p-1" taskId="task-8" />);
    await screen.findByText(/Manager approval required/);

    await user.type(screen.getByLabelText(/comment/i), "please fix X");
    await user.click(screen.getByRole("button", { name: /request changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/hitl"), expect.anything()));
  });

  it("'Later' closes the drawer without calling the hitl endpoint", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(TASK_DETAIL)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewGateDrawer open onClose={onClose} projectId="p-1" taskId="task-8" />);
    await screen.findByText(/Manager approval required/);

    await user.click(screen.getByRole("button", { name: /later/i }));

    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/hitl"), expect.anything());
  });
});
