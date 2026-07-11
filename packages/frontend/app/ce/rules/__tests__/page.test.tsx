import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CeRulesPage from "../page";

const PENDING = { pending: true };

const REPORT = {
  pending: false,
  results: [
    {
      shape_iri: "urn:s1",
      focus_node: "urn:e1",
      path: "urn:weave:ontology:description",
      message: "missing description",
      severity: "Violation",
    },
  ],
  rules: [
    { shape_iri: "urn:s1", severity: "Violation", description: "Activity must have a description", origin: "tenant", violation_count: 1 },
    { shape_iri: "urn:s2", severity: "Info", description: "Goal should link a servesGoal", origin: "framework", violation_count: 0 },
  ],
  ran_at: "2026-07-11T00:00:00Z",
  version_resolved: "unversioned",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CeRulesPage", () => {
  it("shows the honest pending state before any run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, PENDING)));
    render(<CeRulesPage />);
    await waitFor(() => expect(screen.getByTestId("rules-pending")).toBeInTheDocument());
  });

  it("renders the rule list with severities and zero-violation shapes after a run", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount += 1;
        return jsonResponse(200, callCount === 1 ? PENDING : REPORT);
      })
    );
    render(<CeRulesPage />);
    await waitFor(() => expect(screen.getByTestId("rules-pending")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Run validation"));

    await waitFor(() => expect(screen.getByTestId("rule-list")).toBeInTheDocument());
    expect(screen.getByText("Violation")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Activity must have a description")).toBeInTheDocument();
    expect(screen.getByText("Goal should link a servesGoal")).toBeInTheDocument();
    expect(screen.getByText("urn:e1")).toBeInTheDocument();
  });

  it("shows an error state when the proxy call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "store_unavailable" })));
    render(<CeRulesPage />);
    await waitFor(() =>
      expect(screen.getByText("Could not load the validation report.")).toBeInTheDocument()
    );
  });
});
