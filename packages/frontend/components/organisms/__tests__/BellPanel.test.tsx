import { render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { BellPanel, type BellPanelNotification } from "../BellPanel";

const TODAY = new Date();
const YESTERDAY = new Date(TODAY.getTime() - 24 * 60 * 60 * 1000);

function notif(overrides: Partial<BellPanelNotification>): BellPanelNotification {
  return {
    id: "n-1",
    label: "Ontology published",
    eventType: "ontology.version.published",
    read: false,
    createdAt: TODAY.toISOString(),
    ...overrides,
  };
}

describe("BellPanel", () => {
  it("groups rows by day with a day heading per group", () => {
    render(
      <BellPanel
        notifications={[
          notif({ id: "n-1", createdAt: TODAY.toISOString() }),
          notif({ id: "n-2", createdAt: YESTERDAY.toISOString(), label: "Budget cap reached" }),
        ]}
      />
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("deep-links a row with a targetIri to /ce/resource?iri=...", () => {
    render(
      <BellPanel
        notifications={[notif({ targetIri: "urn:weave:entity:acme" })]}
      />
    );
    const link = screen.getByRole("link", { name: /Ontology published/ });
    expect(link).toHaveAttribute("href", "/ce/resource?iri=urn%3Aweave%3Aentity%3Aacme");
  });

  it("renders a mark-all-read control that fires once for the whole panel", async () => {
    const onMarkAllRead = vi.fn();
    render(<BellPanel notifications={[notif({})]} onMarkAllRead={onMarkAllRead} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("renders audit.chain.invalid with no mute control for workspace_admin/compliance_officer", () => {
    render(
      <BellPanel
        notifications={[notif({ id: "n-1", eventType: "audit.chain.invalid", label: "Audit chain broken" })]}
        role="workspace_admin"
        onMute={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /mute/i })).not.toBeInTheDocument();
  });

  it("renders a mute control for a suppressible type for the same role", () => {
    render(
      <BellPanel
        notifications={[notif({ id: "n-1", eventType: "job.completed", label: "Job done" })]}
        role="workspace_admin"
        onMute={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /mute/i })).toBeInTheDocument();
  });
});
