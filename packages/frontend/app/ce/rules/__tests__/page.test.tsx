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
    {
      shape_iri: "urn:s1",
      severity: "Violation",
      description: "Activity must have a description",
      origin: "tenant",
      violation_count: 1,
      target_class: "urn:weave:ontology:Activity",
      constraint_summary: "sh:minCount 1 on weave:description",
    },
    {
      shape_iri: "urn:s2",
      severity: "Info",
      description: "Goal should link a servesGoal",
      origin: "framework",
      violation_count: 0,
      target_class: null,
      constraint_summary: null,
    },
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
    // G1: constraint_summary shows the formal SHACL constraint, distinct from description.
    expect(screen.getByText("sh:minCount 1 on weave:description")).toBeInTheDocument();

    // Violating entities collapse behind the expandable row (rules-table.tsx)
    // -- expand the first rule to see them, matching refit-mock.html's
    // click-to-toggle `.viol-row`.
    expect(screen.queryByText("urn:e1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("s1"));
    expect(screen.getByText("urn:e1")).toBeInTheDocument();
  });

  it("shows an error state when the proxy call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "store_unavailable" })));
    render(<CeRulesPage />);
    await waitFor(() =>
      expect(screen.getByText("Could not load the validation report.")).toBeInTheDocument()
    );
  });

  it("opens the New rule drawer and refreshes the rule list once a rule is committed", async () => {
    let validateCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const target = String(url);
        if (target.startsWith("/api/proxy/validate")) {
          validateCalls += 1;
          return jsonResponse(200, validateCalls === 1 ? PENDING : REPORT);
        }
        if (target.endsWith("/preview")) return jsonResponse(200, { shape_turtle: "weave:FooShape a sh:NodeShape ." });
        if (target.endsWith("/commit")) return jsonResponse(201, { shape_iri: "urn:weave:shapes:FooShape" });
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    render(<CeRulesPage />);
    await waitFor(() => expect(screen.getByTestId("rules-pending")).toBeInTheDocument());

    fireEvent.click(screen.getByText("New rule"));
    fireEvent.change(screen.getByLabelText("Describe the rule"), {
      target: { value: "Every Foo must have a bar." },
    });
    fireEvent.click(screen.getByText("Preview"));
    await waitFor(() => expect(screen.getByDisplayValue("weave:FooShape a sh:NodeShape .")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Commit"));

    await waitFor(() => expect(screen.getByTestId("rule-list")).toBeInTheDocument());
    expect(validateCalls).toBe(2);
  });

  it("switches to the Policies tab, lists policies and opens the attach picker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const target = String(url);
        if (target.startsWith("/api/proxy/validate")) return jsonResponse(200, PENDING);
        if (target === "/api/proxy/sparql") {
          return jsonResponse(200, { rows: [{ s: "urn:weave:instances:policy-1", label: "Vendor risk policy" }] });
        }
        return jsonResponse(200, { results: [] });
      })
    );

    render(<CeRulesPage />);
    await waitFor(() => expect(screen.getByTestId("rules-pending")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Policies" }));
    await waitFor(() => expect(screen.getByText("Vendor risk policy")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Attach"));
    expect(screen.getByText("Attach to Vendor risk policy")).toBeInTheDocument();
  });
});
