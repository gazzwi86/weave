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

  it("shows the unread count as a badge on the trigger", async () => {
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

    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("opens the panel and lists notifications by event_type", async () => {
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

    await waitFor(() => expect(screen.getByText("job.completed")).toBeInTheDocument());
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
});
