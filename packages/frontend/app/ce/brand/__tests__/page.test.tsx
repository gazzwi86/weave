import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import BrandPage from "../page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/api/auth/session")) return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
      if (url.includes("/api/proxy/sparql")) {
        return jsonResponse(200, {
          results: {
            bindings: [
              {
                s: { value: "urn:weave:instances:bs-1" },
                contentType: { value: "acme.tone" },
                effectiveDate: { value: "2026-01-01" },
                owner: { value: "Brand Team" },
                ruleId: { value: "no-jargon" },
                severity: { value: "critical" },
                assertion: { value: "forbidden-term:synergy" },
              },
            ],
          },
        });
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
});
