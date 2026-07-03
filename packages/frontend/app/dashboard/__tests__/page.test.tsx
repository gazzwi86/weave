import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import DashboardPage from "../page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            sub: "dev-user-1",
            tenant_id: "tenant-1",
            principal_iri: "urn:weave:principal:dev-user-1",
          }),
          { status: 200 }
        )
      )
    );
  });

  it("renders the placeholder and makes zero Constitution Engine calls (AC-5)", async () => {
    render(await DashboardPage());

    expect(
      screen.getByText("Your dashboard activates with the Constitution Engine")
    ).toBeInTheDocument();

    const calledUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    const ceCalls = calledUrls.filter(
      (url) => url.includes("/api/dashboard/metrics") || url.includes("/api/ontology")
    );
    expect(ceCalls).toEqual([]);
  });

  it("keeps the existing whoami principal check intact", async () => {
    render(await DashboardPage());

    expect(screen.getByTestId("principal-iri")).toHaveTextContent(
      "urn:weave:principal:dev-user-1"
    );
  });

  // QA edge case (checklist item 14): the existing AC-5 test only greps for
  // CE/metrics URL substrings -- it would miss any *other* unexpected
  // outbound call the page might grow (e.g. an accidental analytics beacon,
  // a second whoami retry). Assert the network-call count itself: exactly
  // one fetch, the whoami check, and nothing else.
  it("issues exactly one outbound fetch call total (the whoami check, no more)", async () => {
    render(await DashboardPage());

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/api/whoami");
  });
});
