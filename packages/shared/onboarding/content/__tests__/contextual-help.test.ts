import { describe, expect, it } from "vitest";

import { areaForPathname } from "../contextual-help";

describe("areaForPathname", () => {
  it("maps constitution and explorer routes", () => {
    expect(areaForPathname("/ce")).toBe("constitution");
    expect(areaForPathname("/ce/versions")).toBe("constitution");
    expect(areaForPathname("/explorer")).toBe("explorer");
  });

  // ONB-TASK-008: the real Audit/Compliance route is /audit/compliance, not
  // /compliance -- the prior startsWith("/compliance") check never matched
  // it, so the compliance welcome modal/beacon gating silently never fired.
  it("maps the real /audit/compliance route to the compliance area", () => {
    expect(areaForPathname("/audit/compliance")).toBe("compliance");
  });

  it("maps settings sub-routes", () => {
    expect(areaForPathname("/settings/members")).toBe("settings");
  });

  it("returns null for unmapped or null pathnames", () => {
    expect(areaForPathname("/audit/logs")).toBeNull();
    expect(areaForPathname(null)).toBeNull();
  });
});
