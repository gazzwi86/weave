import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDetailPanel } from "../task-detail-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DETAIL = {
  brief: { title: "Do thing" },
  handoff: [{ task_id: "task-0", decisions: ["used pattern X"] }],
  console: { live_channel: null, log_location_ref: "s3://bucket/log" },
  captures_manifest_ref: "s3://bucket/captures/manifest.json",
};

function routeFetch(url: string): Response {
  if (url.endsWith("/console-log")) return jsonResponse({ log: "line one" });
  if (url.endsWith("/captures")) return jsonResponse({ manifest: null });
  if (url.endsWith("/audit")) return jsonResponse({ error: "audit_unavailable" }, 503);
  return jsonResponse(DETAIL);
}

describe("TaskDetailPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => routeFetch(url)));
  });

  // AC-2
  it("renders the Brief tab by default and switches to every other tab", async () => {
    const user = userEvent.setup();
    render(<TaskDetailPanel projectId="p-1" taskId="task-1" />);

    await waitFor(() => expect(screen.getByTestId("task-panel-brief")).toBeInTheDocument());
    expect(screen.getByText(/Do thing/)).toBeInTheDocument();

    await user.click(screen.getByTestId("task-tab-handoff"));
    expect(screen.getByTestId("task-panel-handoff")).toBeInTheDocument();
    expect(screen.getByText(/used pattern X/)).toBeInTheDocument();

    await user.click(screen.getByTestId("task-tab-tests"));
    await waitFor(() => expect(screen.getByTestId("task-panel-tests")).toBeInTheDocument());

    await user.click(screen.getByTestId("task-tab-console"));
    await waitFor(() => expect(screen.getByTestId("task-panel-console")).toBeInTheDocument());

    await user.click(screen.getByTestId("task-tab-audit"));
    await waitFor(() => expect(screen.getByTestId("task-panel-audit")).toBeInTheDocument());
  });

  // AC-3: honest absence, never a broken image
  it("shows captures not available when the manifest is missing", async () => {
    const user = userEvent.setup();
    render(<TaskDetailPanel projectId="p-1" taskId="task-1" />);
    await waitFor(() => screen.getByTestId("task-panel-brief"));

    await user.click(screen.getByTestId("task-tab-tests"));
    await waitFor(() =>
      expect(screen.getByTestId("captures-not-available")).toBeInTheDocument()
    );
  });

  // AC-4: finished run reads S3 log content
  it("reads the finished-run console log from the content route", async () => {
    const user = userEvent.setup();
    render(<TaskDetailPanel projectId="p-1" taskId="task-1" />);
    await waitFor(() => screen.getByTestId("task-panel-brief"));

    await user.click(screen.getByTestId("task-tab-console"));
    await waitFor(() => expect(screen.getByTestId("console-log")).toHaveTextContent("line one"));
  });

  // AC-5: audit unavailable, never fabricated
  it("shows audit unavailable on a 503, never fabricated entries", async () => {
    const user = userEvent.setup();
    render(<TaskDetailPanel projectId="p-1" taskId="task-1" />);
    await waitFor(() => screen.getByTestId("task-panel-brief"));

    await user.click(screen.getByTestId("task-tab-audit"));
    await waitFor(() => expect(screen.getByTestId("audit-unavailable")).toBeInTheDocument());
  });
});
