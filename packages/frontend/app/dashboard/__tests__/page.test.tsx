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
});
