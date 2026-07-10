import { render, screen } from "@testing-library/react";
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

  it("keeps the existing whoami principal check intact", async () => {
    render(await DashboardPage());

    expect(screen.getByTestId("principal-iri")).toHaveTextContent(
      "urn:weave:principal:dev-user-1"
    );
  });

  it("issues exactly two outbound fetch calls total (whoami + widgets, no more)", async () => {
    render(await DashboardPage());

    expect(fetch).toHaveBeenCalledTimes(2);
    const calledUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes("/api/whoami"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/dashboard/widgets"))).toBe(true);
  });
});
