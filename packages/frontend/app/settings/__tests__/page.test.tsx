import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("SettingsPage landing (General, supersedes TASK-030 AC-7's Members-redirect)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/tenancy/workspaces/active") return jsonResponse({ workspace_id: null });
        if (url === "/api/tenancy/workspaces") return jsonResponse([]);
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
  });

  it("renders General directly at /settings instead of redirecting", async () => {
    const { default: SettingsPage } = await import("../page");
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
  });

  it("uses company-scope copy (never 'every workspace') across settings surfaces (R7 sweep)", () => {
    const modelsSource = readFileSync(join(__dirname, "..", "models", "page.tsx"), "utf-8");
    expect(modelsSource).not.toContain("every workspace");
  });
});
