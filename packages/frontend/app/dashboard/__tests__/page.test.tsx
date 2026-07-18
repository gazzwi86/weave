import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import DashboardPage from "../page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The recent-activity feed reads tenant_id off the session token (GET /api/audit
// requires it). The mock accessToken "token-abc" isn't a real JWT, so stub the
// claims decode to the same tenant WHOAMI_BODY carries.
vi.mock("@/lib/auth/session-claims", () => ({
  getSessionClaims: () => ({ role: "admin", tenantId: "tenant-1" }),
}));

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
  // v5 Home: recent-activity feed reads the newest audit entries (admin-only
  // upstream; fail-soft to [] otherwise).
  if (url.includes("/api/audit")) {
    return new Response(
      JSON.stringify({
        entries: [
          { seq: 9, ts: "2026-07-16T10:00:00Z", engine: "Build", event_type: "run.completed", target_iri: "https://weave.io/instances/returns-intake" },
        ],
        total: 1,
        page: 1,
        per_page: 6,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (url.includes("scope=user")) {
    return new Response(JSON.stringify({ widgets: [] }), { status: 200 });
  }
  if (url.includes("/api/dashboard/widgets")) {
    return new Response(JSON.stringify(WIDGETS_BODY), { status: 200 });
  }
  // "Needs you" rule-violations row: NeedsYou's own useRules() cache-only
  // read (client component, not server-fetched -- same isolation pattern as
  // the checklist widget's own bootstrap fetch above).
  if (url.includes("/api/proxy/validate")) {
    return new Response(
      JSON.stringify({
        pending: false,
        results: [
          {
            shape_iri: "urn:weave:shape:ProcessOwnerShape",
            focus_node: "urn:weave:instance:order-handling",
            path: null,
            message: "2 processes are missing owners",
            severity: "Violation",
          },
        ],
        rules: [],
        ran_at: "2026-07-16T09:00:00Z",
        version_resolved: "draft",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
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

  it("issues a bounded set of outbound fetches (whoami + both widget scopes + library + recent activity + checklist state + rule-violations cache read), no CE-METRICS creep", async () => {
    render(await DashboardPage());
    // Seven: the original six plus NeedsYou's own cache-only validate read
    // (v5 Home "Needs you" row). The point of this guard is "no unbounded/
    // CE-METRICS-on-load creep" (AC-6), not a frozen literal -- every URL
    // below is asserted explicitly.
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(7));

    const calledUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes("/api/whoami"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("scope=tenant_default"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("scope=user"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/dashboard/library"))).toBe(true);
    // Assert the audit call carries tenant_id -- the exact param whose absence
    // caused the 422 regression; a bare "/api/audit fires" check wouldn't catch a re-drop.
    expect(calledUrls.some((url) => url.includes("/api/audit") && url.includes("tenant_id=tenant-1"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/onboarding/state"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/proxy/validate"))).toBe(true);
  });

  // v5 Home #screen-home: "How Weave works" explain band, static copy.
  it("renders the 'How Weave works' explain band", async () => {
    render(await DashboardPage());

    expect(screen.getByText(/How Weave works:/)).toBeInTheDocument();
  });

  // v5 Home "Needs you": gates + decisions have no cross-workspace feed yet
  // (gap G12) -- rendered as an honest pending row, not faked data.
  it("renders 'Needs you' gate and decision rows as pending with a gap note", async () => {
    render(await DashboardPage());

    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.getAllByText(/gap G12/)).toHaveLength(2);
  });

  // v5 Home "Needs you": rule violations are live via useRules' cache-only
  // validate read (the one feed that does exist).
  it("renders the live rule-violations count in 'Needs you'", async () => {
    render(await DashboardPage());

    await waitFor(() => expect(screen.getByTestId("needs-you-violations")).toHaveTextContent("1"));
  });

  // v5 Home kind-tile row: Constitution's entity count comes from the
  // already-fetched tenant_default widget, not a new ontology fetch.
  it("renders the Constitution tile's live entity count from the fetched widget", async () => {
    render(await DashboardPage());

    expect(screen.getByText("42 entities")).toBeInTheDocument();
  });

  // v5 Home "Get going": guided tour / query / onboarding-path cards.
  it("renders the 'Get going' cards", async () => {
    render(await DashboardPage());

    expect(screen.getByText("Guided tour")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ask your first question/ })).toHaveAttribute("href", "/ce/query");
    expect(screen.getByRole("link", { name: /Tune your path/ })).toHaveAttribute(
      "href",
      "/settings/onboarding-path"
    );
  });
});
