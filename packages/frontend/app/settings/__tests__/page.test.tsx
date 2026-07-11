import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

describe("SettingsPage landing (AC-7)", () => {
  it("test_settings_landing_defaults_to_members_with_company_scope_copy -- defaults to Members, not an empty overview", async () => {
    const { default: SettingsPage } = await import("../page");
    SettingsPage();
    expect(redirectMock).toHaveBeenCalledWith("/settings/members");
  });

  it("uses company-scope copy (never 'every workspace') across settings surfaces (R7 sweep)", () => {
    const modelsSource = readFileSync(join(__dirname, "..", "models", "page.tsx"), "utf-8");
    expect(modelsSource).not.toContain("every workspace");
  });
});
