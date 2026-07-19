import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NeedsYou } from "../needs-you";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(gatesCount: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/proxy/validate")) {
        return jsonResponse({ pending: true, results: [], rules: [] });
      }
      if (url.includes("/api/build/projects") && !url.includes("/gates")) {
        return jsonResponse({ items: [{ project_iri: "p-1", name: "Project 1" }] });
      }
      if (url.includes("/gates")) {
        return jsonResponse({
          project_iri: "p-1",
          gates: Array.from({ length: gatesCount }, (_, i) => ({ task_id: `t-${i}` })),
        });
      }
      return jsonResponse({}, 404);
    })
  );
}

describe("NeedsYou gates row (H4: wires G12 pending-gates feed)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the honest empty state when no gates are pending", async () => {
    stubFetch(0);
    render(<NeedsYou />);

    await waitFor(() =>
      expect(screen.getByTestId("needs-you-gates")).toHaveTextContent("nothing waiting right now")
    );
  });

  it("shows the pending count once the gates feed resolves", async () => {
    stubFetch(2);
    render(<NeedsYou />);

    await waitFor(() => expect(screen.getByTestId("needs-you-gates")).toHaveTextContent("2"));
    expect(screen.getByTestId("needs-you-gates")).toHaveTextContent(/review gates/i);
  });

  it("still renders the decisions row statically (no distinct pending-decisions source exists)", async () => {
    stubFetch(0);
    render(<NeedsYou />);

    expect(screen.getByTestId("needs-you-decisions")).toHaveTextContent("nothing waiting right now");
  });
});
