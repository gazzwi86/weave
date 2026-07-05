import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CompliancePage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const COMPLIANCE_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
};

describe("CompliancePage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders chain status and event category counts (AC-7)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(COMPLIANCE_SUMMARY))
    );

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent("valid"));
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    expect(screen.getByTestId("event-category-list")).toHaveTextContent("workspace: 12");
    expect(screen.getByTestId("event-category-list")).toHaveTextContent("security: 3");
  });

  it("never renders a diff_summary field, for any role (AC-7 structural redaction)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(COMPLIANCE_SUMMARY))
    );

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.queryByText(/diff_summary/i)).not.toBeInTheDocument();
  });

  it("shows a load error when the compliance fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502))
    );

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("compliance-error")).toBeInTheDocument());
  });
});
