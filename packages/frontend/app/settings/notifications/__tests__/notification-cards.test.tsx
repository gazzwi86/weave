import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationCards } from "../notification-cards";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MODEL_EVENT = "model.version.published";
const AUDIT_EVENT = "audit.chain.invalid";
const MODEL_TOGGLE_TESTID = `toggle-in-app-${MODEL_EVENT}`;
const AUDIT_TOGGLE_TESTID = `toggle-in-app-${AUDIT_EVENT}`;

const TYPES = [
  { event_type: MODEL_EVENT, group: "Model", in_app_enabled: true },
  { event_type: "build.gate.waiting", group: "Build", in_app_enabled: true },
  { event_type: AUDIT_EVENT, group: "Governance", in_app_enabled: true },
];

describe("NotificationCards", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("groups preference types into one card per backend group, in-app pre-filled from GET (AC-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ types: TYPES, role: "engineer" })));

    render(<NotificationCards />);

    await waitFor(() => expect(screen.getByTestId(MODEL_TOGGLE_TESTID)).toBeChecked());
    expect(screen.getByRole("heading", { name: "Model" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Governance" })).toBeInTheDocument();
  });

  it("shows a single 'later release' note for email instead of a per-row control (AC-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ types: TYPES, role: "engineer" })));

    render(<NotificationCards />);

    await waitFor(() => expect(screen.getByTestId(MODEL_TOGGLE_TESTID)).toBeChecked());
    expect(screen.getByText(/later release/i)).toBeInTheDocument();
  });

  it("PUTs the new channel list when an unlocked in-app toggle is turned on (AC-5)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return jsonResponse({ saved: true });
      return jsonResponse({
        types: [{ event_type: MODEL_EVENT, group: "Model", in_app_enabled: false }],
        role: "engineer",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationCards />);

    await waitFor(() => expect(screen.getByTestId(MODEL_TOGGLE_TESTID)).not.toBeChecked());
    fireEvent.click(screen.getByTestId(MODEL_TOGGLE_TESTID));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ event_type: MODEL_EVENT, channels: ["in_app"] }),
        })
      )
    );
  });

  it("locks the audit.chain.invalid toggle for workspace_admin/compliance_officer and issues no PUT (AC-6)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") throw new Error("must not PUT a locked row");
      return jsonResponse({ types: TYPES, role: "workspace_admin" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationCards />);

    await waitFor(() => expect(screen.getByTestId(AUDIT_TOGGLE_TESTID)).toBeDisabled());
    fireEvent.click(screen.getByTestId(AUDIT_TOGGLE_TESTID));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/notifications/preferences",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("shows a load-error message when preferences fail to load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

    render(<NotificationCards />);

    await waitFor(() => expect(screen.getByTestId("preferences-error")).toBeInTheDocument());
  });
});
