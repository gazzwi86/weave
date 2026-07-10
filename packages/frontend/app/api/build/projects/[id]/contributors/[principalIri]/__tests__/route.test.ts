import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

function stubFetch(status: number): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
}

function params(): { params: Promise<{ id: string; principalIri: string }> } {
  return {
    params: Promise.resolve({ id: "p-1", principalIri: "urn:weave:principal:user:client" }),
  };
}

describe("/api/build/projects/[id]/contributors/[principalIri]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(204);
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes a contributor (AC-5) and returns 204", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(204);
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/projects/p-1/contributors/urn%3Aweave%3Aprincipal%3Auser%3Aclient"
      ),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(response.status).toBe(204);
  });

  it("passes a 403 forbidden response through as-is (editor denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "forbidden", action: "contributors" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          })
      )
    );
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "contributors" });
  });
});
