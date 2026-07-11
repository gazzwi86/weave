import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationCenter } from "../notification-center";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(notifications: unknown[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/read")) {
      return jsonResponse({ id: "n-1", read: true });
    }
    return jsonResponse({ notifications, total: notifications.length, page: 1, per_page: 25 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the unread count as a badge on the bell trigger, never a bare text label", async () => {
    stubFetch([
      {
        id: "n-1",
        event_type: "job.completed",
        payload: {},
        delivered_channels: ["in_app"],
        read: false,
        created_at: "2026-07-04T00:00:00Z",
      },
    ]);

    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications" });
    expect(trigger).not.toHaveTextContent("Notifications");
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("opens the day-grouped bell panel and deep-links a row with a target_iri", async () => {
    stubFetch([
      {
        id: "n-1",
        event_type: "job.completed",
        payload: {},
        delivered_channels: ["in_app"],
        read: false,
        created_at: "2026-07-04T00:00:00Z",
        target_iri: "urn:weave:job:n-1",
      },
    ]);

    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    const link = await screen.findByRole("link", { name: "job.completed" });
    expect(link).toHaveAttribute("href", `/ce/resource?iri=${encodeURIComponent("urn:weave:job:n-1")}`);
  });

  it("marking a notification read removes its unread affordance", async () => {
    stubFetch([
      {
        id: "n-1",
        event_type: "job.completed",
        payload: {},
        delivered_channels: ["in_app"],
        read: false,
        created_at: "2026-07-04T00:00:00Z",
      },
    ]);

    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const markReadButton = await screen.findByRole("button", { name: "Mark read" });

    fireEvent.click(markReadButton);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument()
    );
  });

  it("shows an empty state when there are no notifications", async () => {
    stubFetch([]);

    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await waitFor(() => expect(screen.getByText("No notifications yet.")).toBeInTheDocument());
  });

  it("collapses same-session model.version.published notifications into one summary row", async () => {
    stubFetch([
      {
        id: "n-1",
        event_type: "model.version.published",
        payload: { semver: "0.3.0" },
        delivered_channels: ["in_app"],
        read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "n-2",
        event_type: "model.version.published",
        payload: { semver: "0.3.4" },
        delivered_channels: ["in_app"],
        read: false,
        created_at: new Date().toISOString(),
      },
    ]);

    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText("0.3.0 → 0.3.4 published")).toBeInTheDocument();
  });

  it("does not render a suppress control for audit.chain.invalid when the viewer role is workspace_admin", async () => {
    stubFetch([
      {
        id: "n-1",
        event_type: "audit.chain.invalid",
        payload: {},
        delivered_channels: ["in_app"],
        read: false,
        created_at: "2026-07-04T00:00:00Z",
      },
    ]);

    render(<NotificationCenter role="workspace_admin" />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await screen.findByText("audit.chain.invalid");
    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
  });
});
