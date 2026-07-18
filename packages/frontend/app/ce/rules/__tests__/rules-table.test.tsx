import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RulesTable } from "../rules-table";
import type { RuleCoverage, ValidationResultEntry } from "../types";

const RULES: RuleCoverage[] = [
  {
    shape_iri: "urn:weave:shapes:ProcessOwnerShape",
    severity: "Violation",
    description: "Every published process must name exactly one owner.",
    origin: "tenant",
    violation_count: 1,
    target_class: "urn:weave:ontology:Process",
    constraint_summary: "sh:minCount 1 on weave:hasOwner",
  },
  {
    shape_iri: "urn:weave:shapes:SystemStewardShape",
    severity: "Info",
    description: "Systems name a steward actor.",
    origin: "framework",
    violation_count: 0,
    target_class: null,
    constraint_summary: null,
  },
];

const RESULTS: ValidationResultEntry[] = [
  {
    shape_iri: "urn:weave:shapes:ProcessOwnerShape",
    focus_node: "urn:weave:process:order-handling",
    path: "urn:weave:ontology:hasOwner",
    message: "Order handling has no owner.",
    severity: "Violation",
  },
];

describe("RulesTable", () => {
  it("renders one row per rule with target, severity and violation count", () => {
    render(<RulesTable rules={RULES} results={RESULTS} />);

    expect(screen.getByText("ProcessOwnerShape")).toBeInTheDocument();
    expect(screen.getByText("Every published process must name exactly one owner.")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Violation")).toBeInTheDocument();
    expect(screen.getByText("SystemStewardShape")).toBeInTheDocument();
    // G1: constraint_summary renders in the Constraint column; a null
    // (framework rule without one) falls back to an em dash, not a crash.
    expect(screen.getByText("sh:minCount 1 on weave:hasOwner")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps violating entities collapsed until the row is clicked", () => {
    render(<RulesTable rules={RULES} results={RESULTS} />);

    expect(screen.queryByText("Order handling has no owner.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("ProcessOwnerShape"));
    expect(screen.getByText("Order handling has no owner.")).toBeInTheDocument();
    expect(screen.getByText(/order-handling/)).toBeInTheDocument();
  });

  it("shows a 'no violations' detail for a zero-count rule when expanded", () => {
    render(<RulesTable rules={RULES} results={RESULTS} />);

    fireEvent.click(screen.getByText("SystemStewardShape"));
    expect(screen.getByText("No violations.")).toBeInTheDocument();
  });

  it("anchors the onboarding tour id on the first rule row only (ONB-V1-TASK-004)", () => {
    const { container } = render(<RulesTable rules={RULES} results={RESULTS} />);

    expect(container.querySelectorAll('[data-tour-id="ce.rules.violation-report"]')).toHaveLength(1);
    expect(container.querySelector('[data-tour-id="ce.rules.shape-list"]')).toBeInTheDocument();
    expect(screen.getByTestId("rule-list")).toBeInTheDocument();
  });
});
