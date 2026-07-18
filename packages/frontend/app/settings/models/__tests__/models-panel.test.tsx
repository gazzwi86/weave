import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelsPanel } from "../models-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function usageBody(capUtilisationPct: number, totalCostUsd = 188) {
  return {
    period: "2026-07",
    total_tokens: 0,
    total_runs: 0,
    total_cost_usd: totalCostUsd,
    by_workspace: [],
    cap_utilisation_pct: capUtilisationPct,
  };
}

function submitCap(amount: string): void {
  fireEvent.change(screen.getByLabelText("Workspace monthly cap (USD)"), {
    target: { value: amount },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set cap" }));
}

describe("ModelsPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the fixed high/mid tier selects from the validated allow-list", () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(usageBody(0))));

    render(<ModelsPanel />);

    const high = screen.getByLabelText("High tier — judgement work");
    const mid = screen.getByLabelText("Mid tier — volume work");
    expect(high).toHaveValue("claude-opus-4-8");
    expect(mid).toHaveValue("claude-sonnet-5");
    expect(high).toBeDisabled();
    expect(mid).toBeDisabled();
  });

  it("shows the halt-not-silent-swap note", () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(usageBody(0))));

    render(<ModelsPanel />);

    expect(
      screen.getByText(/halts the run rather than silently swapping/i)
    ).toBeInTheDocument();
  });

  it("exposes the model-tiers info tip", () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(usageBody(0))));

    render(<ModelsPanel />);

    expect(screen.getByRole("button", { name: "Model tiers" })).toBeInTheDocument();
  });

  it("loads usage and renders the spend bar fill from cap_utilisation_pct", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(usageBody(38, 188))));

    render(<ModelsPanel />);

    await waitFor(() =>
      expect(screen.getByTestId("spend-bar-fill")).toHaveStyle({ width: "38%" })
    );
    expect(screen.getByText(/\$188\.00/)).toBeInTheDocument();
  });

  it("marks the bar danger-tone once usage reaches the alert threshold", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(usageBody(85))));

    render(<ModelsPanel />);

    await waitFor(() => expect(screen.getByTestId("spend-bar-fill")).toHaveAttribute("data-tone", "danger"));

    fireEvent.change(screen.getByLabelText("Alert at"), { target: { value: "90" } });
    expect(screen.getByTestId("spend-bar-fill")).toHaveAttribute("data-tone", "success");
  });

  it("submits a monthly cap and shows a confirmation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      if (typeof input === "string" && input === "/api/billing/caps") {
        return jsonResponse({ scope_iri: "urn:weave:tenant:t-1", value_usd: 500 });
      }
      return jsonResponse(usageBody(38));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelsPanel />);
    submitCap("500");

    await waitFor(() =>
      expect(screen.getByTestId("cap-result")).toHaveTextContent("Cap set: $500.00")
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/caps",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ value_usd: 500 }) })
    );
  });

  it("shows an inline validation error and does not submit when the amount is empty", () => {
    const fetchMock = vi.fn(async () => jsonResponse(usageBody(0)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Set cap" }));

    expect(screen.getByTestId("cap-validation-error")).toHaveTextContent(
      "Enter an amount greater than $0.00."
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/billing/caps",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("shows the parent-cap message on a 422 cap_exceeds_parent", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      if (typeof input === "string" && input === "/api/billing/caps") {
        return jsonResponse({ detail: { error: "cap_exceeds_parent", parent_cap_usd: 100 } }, 422);
      }
      return jsonResponse(usageBody(0));
    }));

    render(<ModelsPanel />);
    submitCap("500");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Cap exceeds the parent scope's cap ($100.00)."
      )
    );
  });
});
