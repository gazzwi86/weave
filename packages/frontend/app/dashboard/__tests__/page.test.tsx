import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import DashboardPage from "../page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const WHOAMI_BODY = {
  sub: "dev-user-1",
  tenant_id: "tenant-1",
  principal_iri: "urn:weave:principal:dev-user-1",
};

const WIDGETS_BODY = {
  widgets: [
    {
      id: "w-1",
      scope: "tenant_default",
      spec: {
        component_type: "kpi_card",
        title: "Entities in model",
        data_source_contracts: ["CE-METRICS-1"],
        bindings: { field: "entity_count_by_kind", aggregate: "sum" },
        column_span: 3,
      },
      position: 0,
      last_result: 42,
      fetched_at: "2026-07-10T12:00:00Z",
      status: "fresh",
      pending_fields: [],
      suggested: false,
    },
  ],
};

function stubFetch(url: string): Response {
  if (url.includes("/api/whoami")) {
    return new Response(JSON.stringify(WHOAMI_BODY), { status: 200 });
  }
  // TASK-010: checklist widget's own client-side bootstrap fetch -- already
  // dismissed here so it renders nothing and doesn't interfere with these
  // dashboard-page-scoped assertions.
  if (url.includes("/api/onboarding/state")) {
    return new Response(JSON.stringify({ checklist_dismissed_at: "2026-01-01T00:00:00Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (url.includes("/api/dashboard/library")) {
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  }
  if (url.includes("scope=user")) {
    return new Response(JSON.stringify({ widgets: [] }), { status: 200 });
  }
  if (url.includes("/api/dashboard/widgets")) {
    return new Response(JSON.stringify(WIDGETS_BODY), { status: 200 });
  }
  return new Response("not found", { status: 404 });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => stubFetch(String(input)))
    );
  });

  it("AC-3: renders the fixed default dashboard's tiles fetched from the widgets API", async () => {
    render(await DashboardPage());

    expect(screen.getByText("Entities in model")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("AC-6: the widgets list is a pure SWR read -- zero direct CE-METRICS-1/ontology calls", async () => {
    render(await DashboardPage());

    const calledUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    const ceCalls = calledUrls.filter(
      (url) => url.includes("/api/metrics/ontology") || url.includes("/api/ontology")
    );
    expect(ceCalls).toEqual([]);
  });

  it("AC-8: renders the PromptBar trigger", async () => {
    render(await DashboardPage());

    expect(screen.getByTestId("prompt-bar-trigger")).toBeInTheDocument();
  });

  // AC-2: page title renders via the PageHeader organism at --text-h1, not
  // a bespoke h2-sized heading (the built app rendered --text-h2 instead).
  it("renders the page title via PageHeader at --text-h1, not a bespoke size", async () => {
    render(await DashboardPage());

    const heading = screen.getByRole("heading", { level: 1, name: "Weave Dashboard" });
    expect(heading.className).toContain("text-[length:var(--text-h1)]");
  });

  // AC-9: a raw principal URN is never primary text -- it renders via
  // EntityRef (friendly label first, mono id second).
  it("renders the principal via EntityRef, not the raw URN as primary text", async () => {
    render(await DashboardPage());

    const container = screen.getByTestId("principal-iri");
    const primaryLabel = container.querySelectorAll("span")[1]?.textContent;
    expect(primaryLabel).not.toContain("urn:weave:principal:");
    expect(container).toHaveTextContent("urn:weave:principal:dev-user-1");
  });

  it("issues exactly five outbound fetch calls total (whoami + both widget scopes + library + checklist state, no more)", async () => {
    render(await DashboardPage());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));

    const calledUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes("/api/whoami"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("scope=tenant_default"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("scope=user"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/dashboard/library"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/onboarding/state"))).toBe(true);
  });
});
