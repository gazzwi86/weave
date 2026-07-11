import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationMatrix } from "../notification-matrix";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TYPES = [
  { event_type: "model.version.published", group: "Model", in_app_enabled: true },
  { event_type: "audit.chain.invalid", group: "Governance", in_app_enabled: true },
];

describe("NotificationMatrix", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-fills the matrix from GET and disables the email column with a post-v1 pill (AC-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ types: TYPES, role: "engineer" })));

    render(<NotificationMatrix />);

    await waitFor(() =>
      expect(screen.getByTestId("toggle-in-app-model.version.published")).toBeChecked()
    );
    expect(screen.getByLabelText("model.version.published email")).toBeDisabled();
    expect(screen.getByTestId("email-pill-model.version.published")).toHaveTextContent("post-v1");
  });

  it("PUTs the new channel list when an unlocked in-app cell is toggled on (AC-5)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return jsonResponse({ saved: true });
      return jsonResponse({
        types: [{ event_type: "model.version.published", group: "Model", in_app_enabled: false }],
        role: "engineer",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationMatrix />);

    await waitFor(() =>
      expect(screen.getByTestId("toggle-in-app-model.version.published")).not.toBeChecked()
    );
    fireEvent.click(screen.getByTestId("toggle-in-app-model.version.published"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ event_type: "model.version.published", channels: ["in_app"] }),
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

    render(<NotificationMatrix />);

    await waitFor(() =>
      expect(screen.getByTestId("toggle-in-app-audit.chain.invalid")).toBeDisabled()
    );
    fireEvent.click(screen.getByTestId("toggle-in-app-audit.chain.invalid"));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/notifications/preferences",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
