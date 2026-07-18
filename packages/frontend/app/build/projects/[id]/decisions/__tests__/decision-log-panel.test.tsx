import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DecisionLogPanel } from "../decision-log-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ONE_ENTRY = {
  entries: [
    {
      seq: 3,
      ts: "2026-07-11T00:00:03+00:00",
      actor_principal_iri: "urn:weave:principal:user:alice",
      event_type: "gate_result_dor",
      target_iri: "urn:weave:project:t1:acme",
      diff_summary: null,
      kind: "decision",
    },
    {
      seq: 2,
      ts: "2026-07-11T00:00:02+00:00",
      actor_principal_iri: "urn:weave:principal:agent:engineer-lane-1",
      event_type: "write_back_success",
      target_iri: "urn:weave:project:t1:acme",
      diff_summary: null,
      kind: "task_update",
    },
  ],
  next_cursor: null,
};

describe("DecisionLogPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/build/projects/p-1/decisions");
  });

  // AC-5
  it("shows an empty state with the active query when search matches nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ entries: [], next_cursor: null }))
    );

    render(<DecisionLogPanel projectId="p-1" />);

    await waitFor(() => expect(screen.getByTestId("decisions-empty")).toBeInTheDocument());
  });

  // AC-4
  it("renders read-only, with no mutation affordance on the surface", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

    render(<DecisionLogPanel projectId="p-1" />);

    await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /delete|edit|remove|save/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /edit/i })).not.toBeInTheDocument();
  });

  // AC-4: grep-style check -- Build owns no audit-entries copy in its own
  // migrations; PLAT-AUDIT-1's table is the platform's single migration.
  it("has no Build-side audit table in the backend migrations directory", () => {
    const migrationsDir = path.join(
      __dirname,
      "../../../../../../../backend/migrations"
    );
    const files = readFileSync(path.join(migrationsDir, "0005_audit_chain.sql"), "utf8");
    expect(files).toContain("CREATE TABLE");

    const decisionMigrations = readdirSync(migrationsDir).filter((f: string) =>
      f.toLowerCase().includes("decision")
    );
    expect(decisionMigrations).toHaveLength(0);
  });

  // AC-7
  it("renders a category chip per row derived from event_type", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

    render(<DecisionLogPanel projectId="p-1" />);

    await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Task update")).toBeInTheDocument();
  });

  // AC-9
  it("labels the actor human or agent from the actor_principal_iri prefix", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

    render(<DecisionLogPanel projectId="p-1" />);

    await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("shows an audit-unavailable message, never a blank screen, on a 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "audit_unavailable" }, 503))
    );

    render(<DecisionLogPanel projectId="p-1" />);

    await waitFor(() => expect(screen.getByTestId("decisions-unavailable")).toBeInTheDocument());
  });

  // refit-mock.html #sub-bld-decisions: DataTable + decision-detail Drawer,
  // both bound to the real audit-log fields (the mock's question/why-
  // blocked/options-A-B-C content is static, no backend model -- gap G14).
  describe("refit-mock #sub-bld-decisions: detail drawer", () => {
    it("opens the detail drawer with the real audit fields on row click", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

      render(<DecisionLogPanel projectId="p-1" />);
      await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());

      fireEvent.click(screen.getByTestId("decision-row-3"));

      const drawer = await screen.findByRole("dialog");
      expect(drawer).toHaveTextContent("2026-07-11T00:00:03+00:00");
      expect(drawer).toHaveTextContent("urn:weave:principal:user:alice");
      expect(drawer).toHaveTextContent("urn:weave:project:t1:acme");
    });

    it("names the gap for a decision-kind row -- the escalation workflow isn't wired to the audit log", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

      render(<DecisionLogPanel projectId="p-1" />);
      await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("decision-row-3"));

      await screen.findByRole("dialog");
      expect(screen.getByTestId("decision-workflow-gap")).toBeInTheDocument();
    });

    it("omits the workflow gap note for a non-decision row", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

      render(<DecisionLogPanel projectId="p-1" />);
      await waitFor(() => expect(screen.getByTestId("decision-row-2")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("decision-row-2"));

      await screen.findByRole("dialog");
      expect(screen.queryByTestId("decision-workflow-gap")).not.toBeInTheDocument();
    });

    it("closes the drawer via the Close button", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ONE_ENTRY)));

      render(<DecisionLogPanel projectId="p-1" />);
      await waitFor(() => expect(screen.getByTestId("decision-row-3")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("decision-row-3"));
      await screen.findByRole("dialog");

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });
});
