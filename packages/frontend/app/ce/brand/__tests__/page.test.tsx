import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import BrandPage from "../page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(listCallCount: { count: number } = { count: 0 }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/api/auth/session")) return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
      if (url.includes("/api/proxy/sparql")) {
        listCallCount.count += 1;
        // Flat string rows -- real shape of POST /api/proxy/sparql (see
        // queries.ts's SparqlRow docstring), not a raw `{ results: { bindings } }`
        // term wrapper.
        const rows =
          listCallCount.count < 2
            ? [
                {
                  s: "urn:weave:instances:bs-1",
                  contentType: "acme.tone",
                  effectiveDate: "2026-01-01",
                  owner: "Brand Team",
                  ruleId: "no-jargon",
                  severity: "critical",
                  assertion: "forbidden-term:synergy",
                },
              ]
            : [
                {
                  s: "urn:weave:instances:bs-1",
                  contentType: "acme.tone",
                  effectiveDate: "2026-01-01",
                  owner: "Brand Team",
                },
                {
                  s: "urn:weave:instances:bs-2",
                  contentType: "acme.new-tone",
                  effectiveDate: "2026-02-01",
                  owner: "Brand Team",
                },
              ];
        return jsonResponse(200, { rows });
      }
      throw new Error(`unhandled fetch ${url}`);
    })
  );
}

describe("BrandPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  // AC-004-01..04: standards + voice-rule forms and the extraction
  // affordance are all mounted (not just built) on this one page.
  it("mounts the standards list, tabs, and both authoring forms", async () => {
    stubFetch();
    render(<BrandPage />);

    await screen.findByTestId("standard-list");
    expect(screen.getByLabelText(/content type/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract from source/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /voice rules/i }));
    await screen.findByTestId("voice-rule-list");
    expect(screen.getByLabelText(/rule id/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    stubFetch();
    const { container } = render(<BrandPage />);
    await screen.findByTestId("standard-list");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  // Integration (test-requirements table): commits a standard via the
  // CE-WRITE-1 op batch and re-lists it -- crosses StandardForm ->
  // submit-op.ts -> page.tsx's refreshKey bump -> BrandListSection's
  // re-fetch, not just one component in isolation (AC-004-01).
  it("commits a standard via the op batch and re-lists it", async () => {
    const listCallCount = { count: 0 };
    stubFetch(listCallCount);
    const listFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/operations/apply")) {
        return jsonResponse(201, {
          ref_map: { form1: "urn:weave:instances:bs-2" },
          version_iri: "urn:weave:versions:v2",
        });
      }
      return listFetch(input, init);
    });
    render(<BrandPage />);

    await screen.findByTestId("standard-list");
    expect(screen.queryByText(/acme\.new-tone/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/content type/i), { target: { value: "acme.new-tone" } });
    fireEvent.change(screen.getByLabelText(/content body/i), { target: { value: "Always say hello warmly." } });
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText(/^owner/i), { target: { value: "Brand Team" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(listCallCount.count).toBeGreaterThan(1));
    expect(await screen.findByText(/acme\.new-tone/)).toBeInTheDocument();
  });
});
