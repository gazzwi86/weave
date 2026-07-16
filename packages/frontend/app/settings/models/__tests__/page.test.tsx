import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsModelsPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function submitCap(amount: string, workspaceId = ""): void {
  fireEvent.change(screen.getByLabelText("Cap amount (USD)"), {
    target: { value: amount },
  });
  if (workspaceId) {
    fireEvent.change(screen.getByLabelText("Cap scope"), {
      target: { value: workspaceId },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Set cap" }));
}

describe("SettingsModelsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the fixed two-tier model routing rows", () => {
    render(<SettingsModelsPage />);

    expect(screen.getByTestId("routing-fable")).toHaveTextContent("claude-fable-5");
    expect(screen.getByTestId("routing-fable")).toHaveTextContent("judgement-heavy work");
    expect(screen.getByTestId("routing-sonnet")).toHaveTextContent("claude-sonnet-5");
    expect(screen.getByTestId("routing-sonnet")).toHaveTextContent("volume work");
    expect(
      screen.getByText("Routing is fixed two-tier for M1; per-workspace overrides land later.")
    ).toBeInTheDocument();
  });

  it("shows a confirmation when the cap is set", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ scope_iri: "urn:weave:tenant:t-1", value_usd: 50 })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsModelsPage />);
    submitCap("50");

    await waitFor(() =>
      expect(screen.getByTestId("cap-result")).toHaveTextContent(
        "Cap set: $50.00 on the company-wide scope"
      )
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/caps",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ value_usd: 50 }) })
    );
  });

  it("shows an inline error and does not submit when the amount is empty (BUG-04)", () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsModelsPage />);
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ detail: { error: "cap_exceeds_parent", parent_cap_usd: 100 } }, 422)
      )
    );

    render(<SettingsModelsPage />);
    submitCap("500", "ws-1");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Cap exceeds the parent scope's cap ($100.00)."
      )
    );
  });
});
